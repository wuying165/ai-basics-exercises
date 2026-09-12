import "dotenv/config"
import { ChatOpenAI } from '@langchain/openai'
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history' 
import { HumanMessage, SystemMessage } from '@langchain/core/messages'

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

async function inMemoryDemo() {
  const history = new InMemoryChatMessageHistory()

  const systemMessage = new SystemMessage("你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。")
  const userMessage1 = new HumanMessage("你今天吃的什么？")

  await history.addMessage(userMessage1)
  const res1 = await model.invoke([systemMessage, ...(await history.getMessages())])
  await history.addMessage(res1)

  const userMessage2 = new HumanMessage("好吃吗？")
  await history.addMessage(userMessage2)
  const res2 = await model.invoke([systemMessage, ...(await history.getMessages())])
  await history.addMessage(res2)

  console.log("[历史消息记录]")
  const allMessages = await history.getMessages()
  allMessages.forEach((msg, index) => {
    const prefix = msg.typ  === 'human' ? '用户' : '助手'
    console.log(` ${index +1}. [${prefix}]:${msg.content.substring(0,50)}...`);
  })
}

inMemoryDemo()