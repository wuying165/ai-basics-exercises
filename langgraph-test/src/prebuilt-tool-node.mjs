import "dotenv/config";

import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { HumanMessage } from '@langchain/core/messages'
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt'
import { StateGraph, MessagesAnnotation, START, END } from '@langchain/langgraph'
import { ChatOpenAI } from '@langchain/openai'
import { getProductBySku } from './inventory.mock.mjs'

const getProductStock = tool(async({ sku }) => getProductBySku(sku), {
  name: 'get_product_stock',
  description: '根据商品SKU查询商品库存',
  schema: z.object({
    sku: z.string().describe('商品SKU'),
  })
})

const tools = [getProductStock]
const toolNode = new ToolNode(tools)

const llm = new ChatOpenAI({ 
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_API_BASE_URL,
  }
}).bindTools(tools)

const agent = async (state) => {
  const result = await llm.invoke(state.messages)
  return { messages: result }
}

const graph = new StateGraph(MessagesAnnotation)
  .addNode('agent', agent)
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', toolsCondition, ['tools', END])
  .addEdge('tools', "agent")
  .compile()

const result = await graph.invoke({ messages: [
  new HumanMessage({ content: '查查一下 SKU-002 的库存，带上商品名和数字。' }),
] })
// console.log('result', result)

const last = result.messages.at(-1);
console.log(last?.content ?? result.messages);
