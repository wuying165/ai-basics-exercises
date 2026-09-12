import "dotenv/config"
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai'

const COLLECTION_NAME = 'ai_diary';
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

async function retrieveRelevantDiaries(question, k = 2) {
  try {
    const queryVector = await getEmbedding(question)

    const result = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: k,
      metric_type: MetricType.COSINE,
      output_fields: ['id', 'content', 'date', 'mood', 'tags'],
    })

    return result.results
  } catch (error) {
    console.error('检索日记时出错:', error.message);
    return [];
  }
}

async function answerDiaryQuestion(question, k = 2) {
  try {
    
    const retrievedDiaries = await retrieveRelevantDiaries(question, k);

    if (!retrievedDiaries.length) {
      console.log('未找到相关日记');
      return '抱歉，我没有找到相关的日记内容。';
    }

    retrievedDiaries.forEach((diary, i) => {
      console.log(`\n[日记 ${i + 1}] 相似度: ${diary.score.toFixed(4)}`, diary);
    })

    const context = retrievedDiaries.map((diary, i) => `[日记 ${i + 1}]
日期: ${diary.date}
心情: ${diary.mood}
标签: ${diary.tags?.join(', ')}
内容: ${diary.content}`).join('\n\n━━━━━\n\n')


    const prompt = `你是一个温暖贴心的 AI 日记助手。基于用户的日记内容回答问题，用亲切自然的语言。

      请根据以下日记内容回答问题：
      ${context}

      用户问题: ${question}

      回答要求：
      1. 如果日记中有相关信息，请结合日记内容给出详细、温暖的回答
      2. 可以总结多篇日记的内容，找出共同点或趋势
      3. 如果日记中没有相关信息，请温和地告知用户
      4. 用第一人称"你"来称呼日记的作者
      5. 回答要有同理心，让用户感到被理解和关心

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

    await answerDiaryQuestion("我最近做了什么让我感到快乐的事情？", 2)
  } catch (error) {
    console.error('错误:', error.message);
  }
}

main()