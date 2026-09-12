import "dotenv/config"
import { MilvusClient } from "@zilliz/milvus2-sdk-node"
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

    const updateId = 'diary_001';
    const updatedContent = {
      id: updateId,
      content: '今天下了一整天的雨，心情很糟糕。工作上遇到了很多困难，感觉压力很大。一个人在家，感觉特别孤独。',
      date: '2026-01-10',
      mood: 'sad',
      tags: ['生活', '散步', '朋友']
    };

    const vector = await getEmbedding(updatedContent.content)

    const result =  await client.upsert({
      collection_name: COLLECTION_NAME,
      data: [{ ...updatedContent, vector }]
    })

    console.log(`✓ Updated diary entry: ${updateId}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main()