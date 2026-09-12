import 'dotenv/config';
import { MultiServerMCPClient } from'@langchain/mcp-adapters';
import { ChatOpenAI } from'@langchain/openai';
import chalk from'chalk';
import { HumanMessage, SystemMessage, ToolMessage } from'@langchain/core/messages';

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const mcpClient = new MultiServerMCPClient({
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": [
          "/Users/wuying/Desktop/AI-Agent/tool-test/src/my-mcp-server.mjs"
      ]
    },
    "amap-maps-streamableHTTP": {
      "url": "https://mcp.amap.com/mcp?key=" + process.env.AMAP_MAPS_API_KEY
    },
    "filesystem": {
        "command": "npx",
        "args": [
          "-y",
          "@modelcontextprotocol/server-filesystem",
          ...(process.env.ALLOWED_PATHS.split(',') || '')
        ]
    }
  }
});

const tools = await mcpClient.getTools()
const modelWithTools = model.bindTools(tools)


async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new HumanMessage(query)
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await modelWithTools.invoke(messages);
    messages.push(response);

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content}\n`);
      return response.content;
    }

    
    console.log(chalk.bgBlue(`🔍 检测到 ${response.tool_calls.length} 个工具调用`));
    console.log(chalk.bgBlue(`🔍 工具调用: ${response.tool_calls.map(t => t.name).join(', ')}`));

    for (const toolCall of response.tool_calls) {
      const tool = tools.find(t => t.name === toolCall.name);
      if (!tool) {
        throw new Error(`工具 ${toolCall.name} 未找到`);
      }
      const toolResult = await tool.invoke(toolCall.args);

      // 确保 content 是字符串类型
      let contentStr;
      if (typeof toolResult === 'string') {
          contentStr = toolResult;
      } else if (toolResult && toolResult.text) {
          // 如果返回对象有 text 字段，优先使用
          contentStr = toolResult.text;
      }


      messages.push(new ToolMessage({
        content: contentStr,
        tool_call_id: toolCall.id,
    }));
    }
  }

  return messages[messages.length - 1].content;
}

await runAgentWithTools("北京鸟巢附近的酒店或者以鸟巢为中心，主要在8 号地铁上支持桓冲，尽量靠近地铁站，去鸟巢的路线时间控制在一个小时左右，生成文档保存到 /Users/wuying/Desktop 的一个 md 文件");
await mcpClient.close();