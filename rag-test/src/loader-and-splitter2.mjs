
import "dotenv/config"
import "cheerio"
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters"
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDINGS_MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

const cheerioLoader = new CheerioWebBaseLoader(
  "https://juejin.cn/post/7233327509919547452",
  {
    selector: '.main-area p'
  }
)

const documents = await cheerioLoader.load()

console.log(documents)

const textSplitters = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
  separators: ["。", "!", "？"],
})

const splitDocuments = await textSplitters.splitDocuments(documents)

const vectorStore = await MemoryVectorStore.fromDocuments(splitDocuments, embeddings)
const retriever = vectorStore.asRetriever({ k: 2 })

const questions = ["父亲的去世对作者的人生态度产生了怎样的根本性逆转？"]

for await (const question of questions) {
  
  const retrievedDocs = await retriever.invoke(question)
  const result = await vectorStore.similaritySearchWithScore(question, 3)
  console.log("\n【检索到的文档及相似度评分】")
  
  retrievedDocs.forEach((doc, i) => {
      // 找到对应的评分
    const scoredResult = result.find(([scoredDoc]) =>
      scoredDoc.pageContent === doc.pageContent
    );
    const score = scoredResult ? scoredResult[1] : null;
    const similarity = score !== null ? (1 - score).toFixed(4) : "N/A";
    
    console.log(`\n[文档 ${i + 1}] 相似度: ${similarity}`);
    console.log(`内容: ${doc.pageContent}`);
    
    if (doc.metadata && Object.keys(doc.metadata).length > 0) {
      console.log(`元数据:`, doc.metadata);
    }
  });

  const context = retrievedDocs.map((doc, i) => `[片段${i + 1}]\n${doc.pageContent}`).join("\n\n━━━━━\n\n");

  const prompt = `你是一个文章辅助阅读助手，根据文章内容来解答：

    文章内容：
    ${context}

    问题: ${question}

    你的回答:`

  console.log("\n【AI 回答】")
  const res = await model.invoke(prompt)
  console.log(res.content)
}