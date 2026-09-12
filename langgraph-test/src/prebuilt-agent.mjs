import "dotenv/config";

import { tool, createAgent } from 'langchain'
import { z } from 'zod'
import { MemorySaver } from '@langchain/langgraph'
import { HumanMessage } from '@langchain/core/messages'
import { ChatOpenAI } from '@langchain/openai'
import { getProductBySku } from './inventory.mock.mjs'

const getProductStock = tool(async ({ sku }) => getProductBySku(sku), {
  name: 'get_product_stock',
  description: '根据商品SKU查询商品库存',
  schema: z.object({
    sku: z.string().describe('商品SKU'),
  })
});


const llm = new ChatOpenAI({ 
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE_URL,
  }
})

const agent = createAgent({
  model: llm,
  tools: [getProductStock],
  systemPrompt: '你是一个专业的商品库存查询助手，只能使用 get_product_stock 工具查询商品库存。',
  checkpointer: new MemorySaver(),
})

 const result = await agent.invoke(
  { messages: [new HumanMessage({ content: '查查一下 SKU-002 的库存' })] },
  { configurable: { thread_id: "demo-thread" } }
);


const last = result.messages.at(-1);
console.log(last?.content ?? result.messages);
