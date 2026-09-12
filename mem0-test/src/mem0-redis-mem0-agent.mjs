import "dotenv/config"
import Redis from "ioredis"
import { MemoryClient } from "mem0ai";
import { z } from "zod";
import * as readline from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, HumanMessage, summarizationMiddleware } from "langchain"
import { mapChatMessagesToStoredMessages, mapStoredMessagesToChatMessages, SystemMessage, SystemMessageChunk } from "@langchain/core/messages"

const REDIS_HOST = process.env.REDIS_HOST ?? 'localhost'
const REDIS_PORT = process.env.REDIS_PORT ?? 6379
const REDIS_DB = process.env.REDIS_DB ?? 0
const KEY_PREFIX = process.env.MEMORY_KEY_PREFIX ?? 'agent:short_memory'
const MEMORY_TTL = process.env.MEMORY_TTL_SECONDS ?? 1800

const USER_ID = process.env.MEM0_USER_ID ?? "demo_user_001";
const SESSION_ID = process.env.MEMORY_SESSION_ID ?? 'session_001'
const MEM0_TOP_K = Number(process.env.MEM0_TOP_K ?? 5);

const memorySchema = z.object({
  write_user: z.boolean().describe("写入用户层：换一个新会话仍应保留的长期事实（身份、居住地、长期爱好、饮食禁忌、持久偏好）。不含仅本轮任务。"),
  write_session: z.boolean().describe("写入会话层：当前会话内的任务、目标、文档大纲、方案草稿。仅在本轮有新事实时写入。"),
  reason: z.string().describe("分类理由，一句中文"),
})

const CLASSIFIER_PROMPT = `你是记忆分层分类器。判断本轮对话是否有「新事实」需写入 Mem0，并分到正确层级。

## user 层（跨会话长期）
- 用户身份与画像：姓名、职业、居住地、长期爱好
- 长期偏好与约束：饮食过敏、回答风格、常用技术栈
- 持续数周以上的个人背景（非单次任务）

## session 层（仅当前会话）
- 当前正在做的任务、目标、文档大纲、方案草稿
- 本会话内的进度、决策、待办、临时约定
- 用户明确用「这次」「本轮」「当前会话」描述的工作上下文

## 均不写入
- 寒暄、致谢、纯确认
- 助手生成的通用内容（攻略、示例代码、建议清单），用户未明确采纳为新事实
- 无信息增量的复述

## 决策原则
1. 「这次我们先写 Q1 总结」「当前在排查 XX」→ 优先 session，不要标成 user
2. user 与 session 可同时为 true（如同时说职业+当前任务），但勿把纯会话任务只标 user
3. 一次性请求（如「帮我做旅行攻略」）且未产生需跨轮记住的约定 → 均为 false`


const summaryPrompt =`你是对话摘要助手。请用中文总结以下对话，包含：
1. 讨论的主要话题
2. 用户提到的重要事实（姓名、偏好、日期等，务必保留原文信息）
3. 继续对话所需的关键上下文

保持简洁，不要编造，不要遗漏用户明确说过的信息。

待摘要的对话：
{messages}

摘要：`

function messagesForRedis(messages) {
  return messages.filter((m) => !SystemMessage.isInstance(m) && !SystemMessageChunk.isInstance(m))
}

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

class Mem0MemoryStore {
  constructor ({ client, userId, sessionId, topK, classifier }) {
    this.client = client
    this.userId = userId
    this.sessionId = sessionId
    this.topK = topK
    this.classifier = classifier
  }

  async search(query) {
    const [userRes, sessionRes] = await Promise.all([
       this.client.search(query, {
        filters: { user_id: this.userId },
        topK: this.topK,
      }),
      this.client.search(query, {
        filters: {
          AND: [{ user_id: this.userId }, { run_id: this.sessionId }],
        },
        topK: this.topK,
      }),
    ])
    return { user: userRes.results ?? [], session: sessionRes.results ?? [] }
  }

  buildSystemMessage({ user, session }) {
    const blocks = []
    if (user.length) blocks.push(`【用户长期记忆】\n${user.map((m) => `- ${m.memory}`).join("\n")}`)
    if (session.length) blocks.push(`【会话记忆】\n${session.map((m) => `- ${m.memory}`).join("\n")}`)
    
    if (!blocks.length) return null
    return new SystemMessage(`${blocks.join("\n\n")}\n\n请结合以上记忆回答，勿编造。`)
  }

  async classifyAndPersist(userText, assistantText) {
    const turn = [
      { role: "user", content: userText },
      { role: "assistant", content: assistantText },
    ]

    const { write_user, write_session, reason } = await this.classifier.invoke([
      new SystemMessage(CLASSIFIER_PROMPT),
      new HumanMessage(`用户：${userText}\n助手：${assistantText}`),
    ])

    const written = []
    if (write_user) {
      await this.client.add(turn, { userId: this.userId })
      written.push("user")
    }
    if (write_session) {
      await this.client.add(turn, { userId: this.userId, runId: this.sessionId });
      written.push("session");
    }

    return { written, reason }
  }

  async clear() {
    await this.client.deleteAll({ userId: this.userId })
    await this.client.deleteAll({ userId: this.userId, runId: this.sessionId })
  }
}


async function invokeWithMemory(agent, redisStore, mem0Store, sessionId, userText) {
  const history = await redisStore.loadMessages(sessionId)
  console.log(`  ↳ 从 Redis 加载 ${history.length} 条历史`);

  const { user, session } = await mem0Store.search(userText)
  if (user.length) console.log(`  ↳ Mem0 用户层 ${user.length} 条`);
  if (session.length) console.log(`  ↳ Mem0 会话层 ${session.length} 条`);

  const memoryMsg = mem0Store.buildSystemMessage({ user, session })
  const invokeMessages = [
    ...(memoryMsg ? [memoryMsg] : []),
    ...history,
    new HumanMessage(userText),
  ];

  const result = await agent.invoke(
    {  messages: invokeMessages }, { recursionLimit: 30 }
  )

  const redisMessages = messagesForRedis(result.messages);
  const dropped = result.messages.length - redisMessages.length;
  await redisStore.saveMessages(sessionId, redisMessages)
  const ttl = await redisStore.ttl(sessionId)
  console.log(`  ↳ 写回 Redis ${redisMessages.length} 条 (TTL ${ttl}s)`);
  if (dropped) console.log(`  ↳ 跳过 ${dropped} 条系统消息`);

  const assistantText = String(result.messages.at(-1)?.content ?? "");
  const { written, reason } = await mem0Store.classifyAndPersist(userText, assistantText)
  console.log(`  ↳ 分类: ${reason}`);
  console.log(written.length ? `  ↳ Mem0 写入: ${written.join(", ")}` : "  ↳ Mem0 未写入");
  
  return { messages: result.messages, redisMessages, assistantText };
}

const redis = new Redis({ host: REDIS_HOST, port: REDIS_PORT, db: REDIS_DB })
const mem0 = new MemoryClient({ apiKey: process.env.MEM0_API_KEY })

redis.on("connect", () => console.log("✅ Redis 已连接"));
redis.on("error", (err) => console.error("❌ Redis 错误:", err.message));

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: { baseURL: process.env.OPENAI_BASE_URL }
})
const classifier = model.withStructuredOutput(memorySchema)

const redisStore = new RedisMessageStore({ redis, keyPrefix: KEY_PREFIX, ttlSeconds: MEMORY_TTL })
const mem0Store = new Mem0MemoryStore({ client: mem0, userId: USER_ID, sessionId: SESSION_ID, topK: MEM0_TOP_K, classifier })

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

console.log(`用户 ${USER_ID} | 会话 ${SESSION_ID}`);
console.log("输入 exit / quit / :q 退出，:clear 清空 Redis；:clear-mem0 清空 Mem0\n");

const rl = readline.createInterface({ input: stdin, output: stdout })

let prevCount = (await redisStore.loadMessages(SESSION_ID)).length

try {
  while(true) {
    const userText = (await rl.question("你: ")).trim();
    if (!userText) continue;

    if (["exit", "quit", ":q"].includes(userText.toLowerCase())) break;

    if (userText === ":clear") {
      await redisStore.clear(SESSION_ID)
      prevCount = 0;
      console.log("✅ 已清空记忆")
      continue
    }

    if (userText === ":clear-mem0") {
      await mem0Store.clear();
      console.log("已清空 Mem0 用户层与当前会话层\n");
      continue;
    }

    const { redisMessages, assistantText } = await invokeWithMemory(agent, redisStore, mem0Store, SESSION_ID, userText)
    console.log("\n助手:", assistantText)
    console.log(`Redis 消息数: ${redisMessages.length}`);
    if (redisMessages.length < prevCount + 2) {
      console.log("  ⚡ 已触发压缩");
    }
    prevCount = redisMessages.length
    console.log("\n")
    console.log("当前会话记忆:", redisMessages.map(msg => msg.content).join("\n"))
  }
} finally {
  rl.close();
}

await redis.quit()



/*
 * 测试对话（复制进终端，先来 :clear-mem0 和 :clear）
 *
 * 一、寒暄
 * 你好 / 在吗 / 谢谢
 * → 纯客套，Mem0 不用记。
 *
 * 二、自我介绍
 * 我叫小明，住在杭州，平时喜欢骑行和摄影。
 * 我对海鲜过敏，出差尽量别安排沿海城市。
 * → 换天聊还得知道的事，写 user 层。
 *
 * 三、这会儿在干嘛
 * 这次我们先写 Q1 季度总结，大纲分三块：项目复盘、数据指标、下季度计划。
 * 项目复盘里重点写 order-service 的 500 错误排查过程。
 * → 只管这次聊天的事，写 session 层。
 *
 * 四、长期背景 + 手头活
 * 我长期做后端开发，这次会话的任务是排查 payment-api 超时，先从 P99 日志看起。
 * 另外我之后技术回答都希望带代码示例，这个一直记住。
 * → 职业和当前任务可能两层都写，偏好那条走 user。
 *
 * 五、Redis 和 Mem0 各管啥
 * 刚才说的 payment-api，超时阈值先假设 3 秒。
 * 上一句我说的阈值是多少？
 * → 刚说过的话 Redis 兜得住，不用等 Mem0。
 *
 * 重启 agent（别清 mem0）再问：我是谁？有什么过敏？
 * → 新会话 Redis 是空的，user 层还能认出你。
 *
 * 六、聊多了会压缩（可选，连聊 8 轮以上）
 * 继续完善 Q1 总结 / 把第二段改短 / 加个标题……
 * → 终端会出现「已触发压缩」，老消息变摘要。
 *
 * 推荐顺序：清空 → 寒暄 → 自我介绍 → 当前任务 → 重启验 user → 清 mem0 验 session 没了
 */