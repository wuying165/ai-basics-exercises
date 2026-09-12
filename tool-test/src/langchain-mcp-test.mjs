
import 'dotenv/config';
import { MultiServerMCPClient } from'@langchain/mcp-adapters';
import { ChatOpenAI } from'@langchain/openai';
import chalk from'chalk';
import { HumanMessage, ToolMessage, SystemMessage } from'@langchain/core/messages';

const model = new ChatOpenAI({
  modelName: "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const mcpClient = new MultiServerMCPClient({
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": [
          "/Users/wuying/Desktop/AI-Agent/tool-test/src/my-mcp-server.mjs"
      ]
    }
  }
});

const tools = await mcpClient.getTools();
const modelWithTools = model.bindTools(tools);

const res = await mcpClient.listResources();

let resourceContent = '';
for (const [serverName, resources] of Object.entries(res)) {
  for (const resource of resources) {
    const content = await mcpClient.readResource(serverName, resource.uri);
    resourceContent += content[0].text;
  }
}

async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(resourceContent),
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
      messages.push(new ToolMessage(toolResult, toolCall.id));
    }
  }

  return messages;
}

// await runAgentWithTools("查询002 用户信息");
await runAgentWithTools("MCP Server 的使用指南，总结其核心功能");

await mcpClient.close();