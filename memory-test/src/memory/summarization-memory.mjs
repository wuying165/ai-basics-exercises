import 'dotenv/config';
import { ChatOpenAI } from "@langchain/openai";
import { InMemoryChatMessageHistory } from "@langchain/core/chat_history";
import { HumanMessage, SystemMessage, AIMessage, getBufferString } from "@langchain/core/messages";

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

async function summarizeHistory(messages) {
  if (messages.length === 0) return ""

  const text = getBufferString(messages, { humanPrefix: "用户", aiPrefix: "助手" })
  const prompt = `请总结以下对话的核心内容，保留重要信息：\n\n${text}\n总结：`;

  const res = await model.invoke([new SystemMessage(prompt)])
  return res.content
}

async function summarizationMemoryDemo() {
  const history = new InMemoryChatMessageHistory()

  const maxMessages = 6
  const messages = [
    { type: 'human', content: '我想学做红烧肉，你能教我吗？' },
    { type: 'ai', content: '当然可以！红烧肉是一道经典的中式菜肴。首先需要准备五花肉、冰糖、生抽、老抽、料酒等材料。' },
    { type: 'human', content: '五花肉需要切多大块？' },
    { type: 'ai', content: '建议切成3-4厘米见方的块，这样既容易入味，口感也更好。切好后可以用开水焯一下去除血沫。' },
    { type: 'human', content: '炒糖色的时候有什么技巧吗？' },
    { type: 'ai', content: '炒糖色是关键步骤。用小火慢慢炒，等冰糖完全融化变成焦糖色，冒小泡时就可以下肉了。注意不要炒过头，否则会发苦。' },
    { type: 'human', content: '需要炖多长时间？' },
    { type: 'ai', content: '一般需要炖40-60分钟，用小火慢炖，直到肉变得软糯入味。可以用筷子戳一下，能轻松戳透就说明好了。' },
    { type: 'human', content: '最后收汁的时候要注意什么？' },
    { type: 'ai', content: '收汁时要用大火，不断翻动，让汤汁均匀包裹在肉块上。看到汤汁变得浓稠，颜色红亮就可以出锅了。' },
  ]

  for (const msg of messages) {
    msg.type === 'human' 
      ? await history.addMessage(new HumanMessage(msg.content)) 
      : await history.addMessage(new AIMessage(msg.content))
  }
  
  let allMessages = await history.getMessages()
  if (allMessages.length >= maxMessages) {
    const keepRecent = 2
    const recentMsgs = allMessages.slice(-keepRecent)
    const toSummarize = allMessages.slice(0, -keepRecent)

    const summary = await summarizeHistory(toSummarize)

    await history.clear()
    for (const msg of recentMsgs) {
      await history.addMessage(msg)
    }

    console.log(`\n保留消息数量: ${recentMessages.length}`);
    console.log("保留的消息:", recentMessages.map(m => `${m.constructor.name}: ${m.content}`).join('\n  '));
    console.log(`\n总结内容（不包含保留的消息）: ${summary}`);
  } else {
    console.log("\n消息数量未超过阈值，无需总结")
  }
}

summarizationMemoryDemo()