import 'dotenv/config';
import { MultiServerMCPClient } from'@langchain/mcp-adapters';
import { ChatOpenAI } from'@langchain/openai';
import { HumanMessage, ToolMessage } from'@langchain/core/messages';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { RunnableLambda, RunnableSequence, RunnablePassthrough, RunnableBranch } from '@langchain/core/runnables'

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const mcpClient = new MultiServerMCPClient({
  "mcpServers": {
    "amap-maps-streamableHTTP": {
      "url": "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MAPS_API_KEY
    },
    // "chrome-devtools": {
    //   "command": "npx",
    //   "args": [
    //     "-y",
    //     "chrome-devtools-mcp@latest"
    //   ]
    // },
  }
});

const tools = await mcpClient.getTools()
const modelWithTools = model.bindTools(tools)

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个可以调用 MCP 工具的智能助手。"],
  new MessagesPlaceholder("messages")
])

const llmChain = prompt.pipe(modelWithTools)


const toolExecutor = new RunnableLambda({
  func: async (state) => {
    const toolResults = []

    for (const toolCall of state.response.tool_calls ?? []) {
      const tool = state.tools.find(t => t.name === toolCall.name);
      if (!tool) continue;
      const toolResult = await tool.invoke(toolCall.args);

      // 确保 content 是字符串类型
      const contentStr = typeof toolResult === 'string' ? toolResult : (toolResult?.text || JSON.stringify(toolResult));

      toolResults.push(new ToolMessage({
          content: contentStr,
          tool_call_id: toolCall.id,
      }));
    }

    return toolResults
  }
})

const agentStepChain = RunnableSequence.from([
  RunnablePassthrough.assign({ response: llmChain }),
  RunnableBranch.from([
    // 无工具调用 -> 结束
    [(state) => !state.response.tool_calls || state.response.tool_calls.length === 0,
      new RunnableLambda({ func: async (state) => ({ ...state, done: true, final: state.response.content, messages: [...state.messages, state.response] }) })
    ],

    // 有工具调用 -> 执行工具并更新 messages
    RunnableSequence.from([
      new RunnableLambda({
        func: async (state) => {
          return { ...state, messages: [...state.messages, state.response] };
        }
      }),
      RunnablePassthrough.assign({ toolMessages: toolExecutor }),
      new RunnableLambda({
        func: async (state) => {
          const { messages, toolMessages } = state
          return { ...state, messages: [ ...messages, ...(toolMessages ?? [])], done: false }
        }
      })
    ]),
    
  ])
])

async function runAgentWithTools(query, maxIterations = 30) {

  let state = {
    messages: [new HumanMessage(query)],
    done: false,
    final: null,
    tools
  }
  for (let i = 0; i < maxIterations; i++) {
    state = await agentStepChain.invoke(state)

    if (state.done) {
      return state.final
    }
  }

  return state.messages[state.messages.length - 1].content;
}

await runAgentWithTools("北京鸟巢附近的酒店或者以鸟巢为中心，主要在8 号地铁上支持桓冲，尽量靠近地铁站，去鸟巢的路线时间控制在一个小时左右，生成文档保存到 /Users/wuying/Desktop 的一个 md 文件");
await mcpClient.close();