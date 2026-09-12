import "dotenv/config"
import { Command } from "@langchain/langgraph"
import { createMiddleware, createAgent, HumanMessage, ToolMessage, tool } from "langchain"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"

const getCurrentTime = tool(() => new Date().toLocaleString(), {
  name: "get_current_time",
  description: "返回当前 UTC 时间的 ISO 8601 字符串",
  schema: z.object({}),
})

const extendedToolsMiddleware = createMiddleware({
  name: "ExtendedToolsMiddleware",
  stateSchema: z.object({
    toolInvocationCount: z.number().default(0),
  }),
  tools: [getCurrentTime],
  wrapToolCall: async (request, handler) => {
    const toolName = request.tool?.name ?? request.toolCall.name;
    console.log(
      `[Tools] 即将执行: ${toolName}`,
      "args:",
      request.toolCall.args ?? {}
    );
    const result = await handler(request);
    if (!ToolMessage.isInstance(result)) return result;

    const wrapped = new ToolMessage({
      content: `${result.content}\n[wrapToolCall] 已由 ExtendedToolsMiddleware 包装`,
      tool_call_id: result.tool_call_id,
      name: result.name,
    });
    console.log(
      `[Tools] 执行完成: ${toolName}`,
      typeof wrapped.content === "string"
        ? wrapped.content.slice(0, 120)
        : wrapped
    );
    return new Command({
      update: {
        toolInvocationCount: request.state.toolInvocationCount + 1,
        messages: [wrapped],
      },
    });
  },
  afterAgent: (state) => {
    console.log(
      `[Tools] agent 结束，middleware 统计工具调用: ${state.toolInvocationCount} 次`
    );
  },
});

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME ?? "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
})

const agent = createAgent({
  model,
  tools: [],
  systemPrompt:"你是一个助手。",
  middleware: [extendedToolsMiddleware]
})


for (const text of ["给我当前时间"]) {
  const { messages, toolInvocationCount } = await agent.invoke({ messages: [new HumanMessage(text)] })
  console.log("回复:", messages.at(-1)?.content);
  console.log("toolInvocationCount:", toolInvocationCount);
}