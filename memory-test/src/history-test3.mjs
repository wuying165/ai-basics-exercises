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
  

  const restoredMessages = await history.getMessages()
  console.log(`从文件恢复了${restoredMessages.length}条历史消息：`);

  restoredMessages.forEach((msg, index) => {
    const prefix = msg.type === 'human' ? '用户':'助手'
    console.log(` ${index +1}. [${prefix}]:${msg.content.substring(0,50)}...`);
  })


  const userMessage3 = new HumanMessage("需要哪些食材？")
  await history.addMessage(userMessage3)
  const res3 = await model.invoke([systemMessage, ...(await history.getMessages())])
  await history.addMessage(res3)

  console.log(`用户: ${userMessage3.content}`);
  console.log(`助手: ${res3.content}`);
  console.log(`✓ 对话已更新到文件\n`);
}

fileHistoryDemo()