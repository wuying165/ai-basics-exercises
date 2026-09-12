import "dotenv/config"
import { MetricType, MilvusClient } from "@zilliz/milvus2-sdk-node"
import { OpenAIEmbeddings } from '@langchain/openai'

const COLLECTION_NAME = 'ai_diary'
const VECTOR_DIM = 1024

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDINGS_MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  },
  dimensions: VECTOR_DIM,
})

const client = new MilvusClient({ address: 'localhost:19530' })

async function getEmbedding(text) {
  const result = await embeddings.embedQuery(text)
  return result
}


async function main() {
  try {
    await client.connectPromise

    const query = '我想看看关于户外活动的日记';

    const queryVector = await getEmbedding(query)
    const result = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: 2,
      metric_type: MetricType.COSINE,
      output_fields: ['id', 'content', 'date', 'mood', 'tags']
    })

    result.results.forEach((item, index) => {
      console.log(`${index + 1}. [Score: ${item.score.toFixed(4)}]`, item)
    })
  } catch (error) {
    
  }
}

main()