import "dotenv/config";
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history'
import { HumanMessage } from "@langchain/core/messages";

const COLLECTION_NAME = 'conversations'
const VECTOR_DIM = 1024

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
  },
  dimensions: VECTOR_DIM
})


const client = new MilvusClient({ address : 'localhost:19530' })

async function getEmbedding(text) {
  return await embeddings.embedQuery(text)
}


// 从 Milvus 检索相似对话
async function searchChats(query, k = 2) {
  try {
    const queryVector = await getEmbedding(query)

    const result = await client.search({
      collection_name: COLLECTION_NAME,
      vector: queryVector,
      limit: k,
      metric_type: MetricType.COSINE,
      output_fields: ['id', 'content', 'round', 'timestamp'],
    });
    return result.results;
  } catch (err) {
    console.error('检索失败:', err.message);
    return [];
  }
}

// 将单条对话保存到 Milvus
async function saveChat(text, round) {
  const convId = `conv_${Date.now()}_${round}`;
  const convVector = await getEmbedding(text);

  try {
    await client.insert({
      collection_name: COLLECTION_NAME,
      data: [{
        id: convId,
        vector: convVector,
        content: text,
        round,
        timestamp: new Date().toISOString()
      }]
    });
    console.log(`💾 已保存到 Milvus 向量数据库`);
  } catch (error) {
    console.warn('保存到向量数据库时出错:', error.message);
  }
}


async function main() {
  try {
    console.log('Connecting to Milvus...');
    await client.connectPromise
    console.log('✓ Connected\n');
  } catch (error) {
    console.error('❌ Milvus 未启动:', error.message);
    return;
  }

  const history = new InMemoryChatMessageHistory()
  const questions = [
    '我之前提到的机器学习项目进展如何？',
    '我周末经常做什么？',
    '我的职业是什么？',
  ];

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];

    const userMessage = new HumanMessage(question)
    const retrievedRes = await searchChats(question, 2)

    if (!retrievedRes.length) console.log('未找到相关历史');

    const historyText = (retrievedRes || []).map((h, idx) =>
      `[历史 ${idx + 1}]\n轮次: ${h.round}\n${h.content}`
    ).join('\n\n━━━━━\n\n');

    const promptMsgs = historyText
      ? [new HumanMessage(`相关历史对话：\n${historyText}\n\n用户问题: ${question}`)]
      : [userMessage];

    const res = await model.invoke(promptMsgs)
    await history.addMessage(userMessage)
    await history.addMessage(res)

    // 保存到 Milvus
    const chatText = `用户: ${question}\n助手: ${res.content}`;
    await saveChat(chatText, i + 1);

    console.log(`助手: ${res.content}`);
    
  }
}

main()