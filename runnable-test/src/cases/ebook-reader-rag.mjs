import "dotenv/config"
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'
import { RunnableSequence, RunnableLambda } from "@langchain/core/runnables"
import { PromptTemplate } from "@langchain/core/prompts"
import { StringOutputParser } from "@langchain/core/output_parsers"

const COLLECTION_NAME = 'ebook_collection';
const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDINGS_MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  dimensions: VECTOR_DIM,
})

async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text)
  return result
}

const client = new MilvusClient({ address: 'localhost:19530' })

const promptTemplate = PromptTemplate.fromTemplate(
  `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。

      请根据以下《天龙八部》小说片段内容回答问题：
      ${context}

      用户问题: ${question}

      回答要求：
      1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
      2. 可以综合多个片段的内容，提供完整的答案
      3. 如果片段中没有相关信息，请如实告知用户
      4. 回答要准确，符合小说的情节和人物设定
      5. 可以引用原文内容来支持你的回答

      AI 助手的回答:`
)


const milvusSearch = new RunnableLambda({
  func: async (input) => {
    const { question, k = 5 } = input 
    
    try {
      const queryVector = await getEmbedding(question)

      const result = await client.search({
        collection_name: COLLECTION_NAME,
        vector: queryVector,
        limit: k,
        metric_type: MetricType.COSINE,
        output_fields: ['id', 'book_id', 'chapter_num', 'index', 'content'],
      })

      const results = result.results ?? []
      const retrievedContent = results.map((item, idx) => ({
        id: item.id,
        book_id: item.book_id,
        chapter_num: item.chapter_num,
        index: item.index ?? idx,
        content: item.content,
        score: item.score,
      }));

      return { question, retrievedContent };
    } catch (error) {
      
    }
  }
})

const buildPromptInput = new RunnableLambda({
  func: async (input) => {
    const { question, retrievedContent } = input

    if (!retrievedContent.length) return { question, retrievedContent, hasContext: false, context: "" }

    const context = retrievedContent.map((item, i) => `[片段 ${i + 1}]\n章节: 第 ${item.chapter_num} 章\n内容: ${item.content}]`).join('\n\n━━━━━\n\n')
  
    return { question, retrievedContent, context, hasContext: true }
  }
})

const chain = RunnableSequence.from(
  milvusSearch,
  buildPromptInput,
  new RunnableLambda({}),
  promptTemplate,
  model,
  new StringOutputParser(),
)

async function initMilvusCollection() {
  await client.connectPromise

  try {
    await client.loadCollection({ collection_name: COLLECTION_NAME })
    console.log("✓ 集合已加载\n");
  } catch (error) {
    if (!error.message.includes("already loaded")) {
      throw error;
    }
    console.log("✓ 集合已处于加载状态\n");
  }
}

async function main() {
  try {
    await initMilvusCollection()
    
    const input = { question: "鸠摩智会什么武功？", k: 5,}

    const stream = await chain.stream(input)
    for await (const chunk of stream) {
      process.stdout.write(chunk)
    }
  } catch (error) {
    console.error('错误:', error.message);
  }
}

main()