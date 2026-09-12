import "dotenv/config"
import { ChatOpenAI } from '@langchain/openai'
import { FileSystemChatMessageHistory } from '@langchain/community/stores/message/file_system'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import path from "node:path";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

async function fileHistoryDemo() {
  const filePath =  path.join(process.cwd(), "chat_history.json");
  const sessionId = "user_session_001";
  const history = new FileSystemChatMessageHistory({ filePath, sessionId })

  const systemMessage = new SystemMessage("你是一个友好、幽默的做菜助手，喜欢分享美食和烹饪技巧。")
  const userMessage1 = new HumanMessage("红烧肉怎么做")

  await history.addMessage(userMessage1)
  const res1 = await model.invoke([systemMessage, ...(await history.getMessages())])
  await history.addMessage(res1)
  console.log(`用户: ${userMessage1.content}`);
  console.log(`助手: ${res1.content}`);
  console.log(`✓ 对话已保存到文件: ${filePath}\n`);

  const userMessage2 = new HumanMessage("好吃吗？")
  await history.addMessage(userMessage2)
  const res2 = await model.invoke([systemMessage, ...(await history.getMessages())])
  await history.addMessage(res2)

  console.log(`用户: ${userMessage2.content}`);
  console.log(`助手: ${res2.content}`);
  console.log(`✓ 对话已更新到文件\n`);
}

fileHistoryDemo()