import "dotenv/config"
import { ChatOpenAI } from '@langchain/openai'
import { RunnableWithMessageHistory } from"@langchain/core/runnables";
import { InMemoryChatMessageHistory } from"@langchain/core/chat_history";
import { ChatPromptTemplate, MessagesPlaceholder } from"@langchain/core/prompts";
import { StringOutputParser } from"@langchain/core/output_parsers";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是一个简洁、有帮助的中文助手，会用 1-2 句话回答用户问题，重点给出明确、有用的信息。",
  ],
  new MessagesPlaceholder("history"),
  ["human", "{question}"],
])

const messageHistories = new Map();

const getMessageHistory = (sessionId) => {
  if (!messageHistories.has(sessionId)) {
    messageHistories.set(sessionId, new InMemoryChatMessageHistory())
  }
  return messageHistories.get(sessionId)
}

const chain = new RunnableWithMessageHistory({
  runnable: prompt.pipe(model).pipe(new StringOutputParser()),
  getMessageHistory,
  inputMessagesKey: "question",
  historyMessagesKey: "history"
})

const result = await chain.invoke(
  { question: "我的名字是张三，我来自北京，喜欢编程。", },
  { configurable: { sessionId: "user-123" }}
)

console.log('结果1：', result)

const result2 = await chain.invoke(
  { question: "我来自哪里，干什么的？"},
  { configurable: { sessionId: "user-123" }}
)

console.log('结果2：', result2)

const result3 = await chain.invoke(
  { question: "我的爱好是什么？"},
  { configurable: { sessionId: "user-123" }}
)

console.log('结果3：', result3)