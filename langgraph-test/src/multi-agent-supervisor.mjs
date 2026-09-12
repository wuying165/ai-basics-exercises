import "dotenv/config";

import { tool, createAgent } from 'langchain'
import { z } from 'zod'
import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { createSupervisor } from '@langchain/langgraph-supervisor'
import { lookupCityTrivia, lookupWeather } from"./simple-mock.mjs";


const llm = new ChatOpenAI({ 
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE_URL,
  }
})

const lookupWeatherTool = tool(async ({ city }) => lookupWeather(city), {
  name: 'lookup_weather',
  description: '根据城市查询天气',
  schema: z.object({
    city: z.string().describe('城市名'),
  })
});

const lookupCityTriviaTool = tool(async ({ city }) => lookupCityTrivia(city), {
  name: 'lookup_city_trivia',
  description: '查询与某城市相关的一句趣味知识。',
  schema: z.object({
    city: z.string().describe('城市名'),
  })
});

const weatherAgent = createAgent({
  model: llm,
  tools: [lookupWeatherTool],
  name: "weather_agent",
  description: "专门查天气",
  systemPrompt: '你是一个专业的天气查询助手，只能使用 lookup_weather 工具查询天气。',
})

const triviaAgent = createAgent({
  model: llm,
  tools: [lookupCityTriviaTool],
  name: "trivia_agent",
  description: "专门讲与城市相关的小知识；必须调用 lookup_city_trivia。",
  systemPrompt: "你只讲城市小知识。先 lookup_city_trivia，再用人话转述，不要编造工具里没有的内容。",
})

const workflow = createSupervisor({
  llm,
  agents: [weatherAgent.graph, triviaAgent.graph],
  prompt: `你是调度员，只负责选人，不要自己报气温、也不要自己讲城市百科。

  - 问天气、气温、下不下雨、空气 → 用 weather_agent
  - 问小知识、名胜、历史、一句介绍 → 用 trivia_agent
  `,
})

const app = workflow.compile()
const input = {
  messages: [new HumanMessage({ content: '查一下杭州的天气和城市有关的小知识' })],
}

const nodePath = []
let finalState = null
const stream = await app.stream(input, { streamMode: ["updates", "values"] })
for await (const chunk of stream) {
  const [mode, payload] = chunk
  if (mode === "updates" && payload && typeof payload === "object") {
    nodePath.push(...Object.keys(payload))
  } else if (mode ==='values') {
    finalState = payload
  }
}

console.log("路径:", nodePath.join(" → "));
const last = finalState.messages.at(-1);
console.log(last?.content ?? finalState.messages);
