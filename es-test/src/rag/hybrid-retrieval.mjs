import "dotenv/config"
import { Client } from "@elastic/elasticsearch"
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { Milvus } from '@langchain/community/vectorstores/milvus'
import { Annotation, START, END, StateGraph } from "@langchain/langgraph"
import { DashScopeRerank } from '../rerank/dashscope-rerank.mjs'
import { augmentQuery } from './query-augment.mjs'


const ES_LIMIT = 15;          // ES 召回总数
const MILVUS_LIMIT = 15;      // Milvus 召回总数
const RERANK_TOP = 3;         // 重排后保留数量
const INDEX = "life_notes";   

function dedupById(docs) {
  const seen = new Set()
  
  return docs.filter(d => {
    const id = d.metadata?.id.toString().trim()
    return id && !seen.has(id) && (seen.add(id), true)
  })
}

const esClient = new Client({ node: "http://localhost:9200" })

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-v3",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
  }
})

const milvus = await Milvus.fromExistingCollection(embeddings, {
  collectionName: INDEX,
  url: "http://localhost:19530",
  textField: "doc_text",
  vectorField: "embedding"
})

const reranker = new DashScopeRerank({
  model: process.env.RERANK_MODEL,
  apiKey: process.env.RERANK_API_KEY,
  baseUrl: process.env.RERANK_URL,
  topN: RERANK_TOP,
})

const chatModel = new ChatOpenAI({
  model: process.env.LLM_MODEL_NAME ?? "qwen-turbo",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

const HybridState = Annotation.Root({
  query: Annotation(),
  queryAug: Annotation(),
  esHits: Annotation(),
  milvusHits: Annotation(),
  merged: Annotation(),
  topDocs: Annotation(),
  answer: Annotation(),
})

const esRecallNode = async (state) => {
  const qs = [state.query, ...(state.queryAug?.queries || [])]
  const size = Math.max(2, Math.ceil(ES_LIMIT / qs.length))
  const results = await Promise.all(qs.map((q) => 
    esClient.search({
      index: INDEX, size,
      query: {
        multi_match: {
          query: q,
          fields: ["note_title^2", "note_body", "title", "content"],
          type: "best_fields",
          analyzer: "ik_smart",
        },
      },
    })
  ))

  const docs = results.flatMap(res => res.hits.hits.map(hit => ({
    pageContent: `${hit._source.note_title}\n${hit._source.note_body}`,
    metadata: { id: hit._id, source: 'es', ...hit._source },
  })))

  return { esHits: dedupById(docs) }
}

const milvusRecallNode = async (state) => {
  const qs = [state.query, ...(state.queryAug?.queries || [])]
  const size = Math.max(2, Math.ceil(MILVUS_LIMIT / qs.length))
  const results = await Promise.all(qs.map((q) => milvus.similaritySearch(q, size)))

  return { milvusHits: dedupById(results.flat()) }
}

const mergeNode = async (state) => {
  const all = [...(state.esHits), ...(state.milvusHits)]
  const combined = all.filter(d => d?.pageContent)

  return { merged: dedupById(combined) }
}

const rerankNode = async (state) => {
  if (!state.merged.length) return { topDocs: [] }
  return { topDocs: await reranker.compressDocuments(state.merged, state.query)}
}

const generateNode = async (state) => {
  if (!state.topDocs.length) return { answer: '没有相关文档' }

  const context = state.topDocs.map(d => d.pageContent).join('\n\n---\n\n')
  const prompt = `基于以下片段回答问题：\n${context}\n问题：${state.query}`
  const answer = await chatModel.invoke(prompt)
  return { answer: answer.content }
}

const graph = new StateGraph(HybridState)
  .addNode("augment", async(state) => ({ 
    queryAug: await augmentQuery(chatModel, state.query)
  }))
  .addNode("es", esRecallNode)
  .addNode("milvus", milvusRecallNode)
  .addNode("merge", mergeNode)
  .addNode("rerank", rerankNode)
  .addNode("generate", generateNode)
  .addEdge(START, "augment")
  .addEdge("augment", "es")
  .addEdge("augment", "milvus")
  .addEdge(["es", "milvus"], "merge")
  .addEdge("merge", "rerank")
  .addEdge("rerank", "generate")
  .addEdge("generate", END)
  .compile();

const drawable = await graph.getGraphAsync();
console.log(drawable.drawMermaid());

const result = await graph.invoke({ query: '家里无线老是断断续续咋整' });
console.log(result);