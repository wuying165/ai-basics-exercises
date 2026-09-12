import "dotenv/config"
import Redis from "ioredis"
import * as readline from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, HumanMessage, summarizationMiddleware } from "langchain"
import { mapChatMessagesToStoredMessages, mapStoredMessagesToChatMessages } from "@langchain/core/messages"


const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost'
const REDIS_PORT = process.env.REDIS_PORT ?? 6379
const REDIS_DB = process.env.REDIS_DB ?? 0
const KEY_PREFIX = process.env.MEMORY_KEY_PREFIX ?? 'agent:short_memory'
const SESSION_ID = process.env.MEMORY_SESSION_ID ?? 'user_001'
const MEMORY_TTL = process.env.MEMORY_TTL_SECONDS ?? 1800

const summaryPrompt =`你是对话摘要助手。请用中文总结以下对话，包含：
1. 讨论的主要话题
2. 用户提到的重要事实（姓名、偏好、日期等，务必保留原文信息）
3. 继续对话所需的关键上下文

保持简洁，不要编造，不要遗漏用户明确说过的信息。

待摘要的对话：
{messages}

摘要：`

class RedisMessageStore {
  constructor({ redis, keyPrefix, ttlSeconds = 60 }) {
    this.redis = redis
    this.keyPrefix = keyPrefix
    this.ttlSeconds = ttlSeconds
  }

  messagesKey(sessionId) {
    return `${this.keyPrefix}:${sessionId}:messages`
  }

  async loadMessages(sessionId) {
    const raw = await this.redis.get(this.messagesKey(sessionId))
    if(!raw) return []
    return mapStoredMessagesToChatMessages(JSON.parse(raw))
  }

  async saveMessages(sessionId, messages) {
    const payload = JSON.stringify(mapChatMessagesToStoredMessages(messages))
    await this.redis.set(this.messagesKey(sessionId), payload, 'EX', this.ttlSeconds)
  }

  async clear(sessionId) {
    await this.redis.del(this.messagesKey(sessionId))
  }

  async ttl(sessionId) {
    return this.redis.ttl(this.messagesKey(sessionId))
  }
}

async function invokeWithMemory(agent, store, sessionId, userText) {
  const history = await store.loadMessages(sessionId)
  console.log(`  ↳ 从 Redis 加载 ${history.length} 条历史`);

  const result = await agent.invoke({
    messages: [...history, new HumanMessage(userText)]
  }, { recursionLimit: 30 })

  await store.saveMessages(sessionId, result.messages)
  const ttl = await store.ttl(sessionId)
  console.log(`  ↳ 写回 Redis ${result.messages.length} 条 (TTL ${ttl}s)`);

  return result
}

const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, db: REDIS_DB })

redis.on("connect", () => console.log("✅ Redis 已连接"));
redis.on("error", (err) => console.error("❌ Redis 错误:", err.message));

const store = new RedisMessageStore({ redis, keyPrefix: KEY_PREFIX, ttlSeconds: MEMORY_TTL })

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: { baseURL: process.env.OPENAI_BASE_URL }
})

const agent = createAgent({
  model,
  tools: [],
  systemPrompt: "你是一个智能助手，能够回答用户的问题。",
  middleware: [
    summarizationMiddleware({
      model, 
      summaryPrompt,
      trigger: { messages: 8 },
      keep: { messages: 4 }
    })
  ]
})

console.log("输入 exit / quit / :q 退出，:clear 清空记忆\n");

const rl = readline.createInterface({ input: stdin, output: stdout })

let prevCount = (await store.loadMessages(SESSION_ID)).length

try {
  while(true) {
    const userText = (await rl.question("你: ")).trim();
    if (!userText) continue;

    if (["exit", "quit", ":q"].includes(userText.toLowerCase())) break;

    if (userText === ":clear") {
      await store.clear(SESSION_ID)
      prevCount = 0;
      console.log("✅ 已清空记忆")
      continue
    }

    const { messages } = await invokeWithMemory(agent, store, SESSION_ID, userText)
    console.log("\n助手:", messages.at(-1)?.content)
    console.log(`当前消息数: ${messages.length}`)
    if (messages.length < prevCount + 2) {
      console.log("  ⚡ 已触发压缩");
    }
    prevCount = messages.length
    console.log("\n")
    console.log("当前会话记忆:", messages.map(msg => msg.content).join("\n"))
  }
} finally {
  rl.close();
}

await redis.quit()