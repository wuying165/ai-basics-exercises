import "dotenv/config"
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'

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

const client = new MilvusClient({ address: 'localhost:19530' })

async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text)
  return result
}

async function retrieveRelevantContent(question, k = 2) {
  try {
    const queryVector = await getEmbedding(question)

    const result = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: k,
      metric_type: MetricType.COSINE,
      output_fields: ['id', 'book_id', 'chapter_num', 'index', 'content'],
    })

    return result.results
  } catch (error) {
    console.error('检索日记时出错:', error.message);
    return [];
  }
}

async function answerEbookQuestion(question, k = 2) {
  try {
    
    const retrievedContent = await retrieveRelevantContent(question, k);

    if (!retrievedContent.length) {
      console.log('未找到相关日记');
      return '抱歉，我没有找到相关的日记内容。';
    }

    retrievedContent.forEach((item, i) => {
      console.log(`\n[日记 ${i + 1}] 相似度: ${item.score.toFixed(4)}`, item);
    })

    const context = retrievedContent.map((item, i) => `[片段 ${i + 1}]\n章节: 第 ${item.chapter_num} 章\n内容: ${item.content}]`).join('\n\n━━━━━\n\n')


    const prompt = `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。

      请根据以下《天龙八部》小说片段内容回答问题：
      ${context}

      用户问题: ${question}

      回答要求：
      1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
      2. 可以综合多个片段的内容，提供完整的答案
      3. 如果片段中没有相关信息，请如实告知用户
      4. 回答要准确，符合小说的情节和人物设定
      5. 可以引用原文内容来支持你的回答

      AI 助手的回答:`;

      const result = await model.invoke(prompt)
      console.log(result.content)

      return result.content

  } catch (error) {
    console.error('回答问题时出错:', error.message);
    return '抱歉，处理您的问题时出现了错误。';
  }
}

async function main() {
  try {
    await client.connectPromise

    try {
      await client.loadCollection({ collection_name: COLLECTION_NAME });
      console.log('✓ 集合已加载\n');
    } catch (error) {
      // 如果已经加载，会报错，忽略即可
      if (!error.message.includes('already loaded')) {
        throw error;
      }
      console.log('✓ 集合已处于加载状态\n');
    }

    await answerEbookQuestion("鸠摩智会什么武功？", 2)
  } catch (error) {
    console.error('错误:', error.message);
  }
}

main()