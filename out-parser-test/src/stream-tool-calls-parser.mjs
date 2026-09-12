import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
import { JsonOutputToolsParser } from'@langchain/core/output_parsers/openai_tools';
import { z } from 'zod';

// 1. 初始化模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

// 2. 使用 zod 定义输出结构
const dataSchema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
})

// 3. 绑定工具到模型
const modelWithTool = model.bindTools([{
  name: "extract_data_info",
  description: "提取和结构化科学家的详细信息",
  schema: dataSchema
}])

// 4. 绑定工具并挂在解析器
const parser = new JsonOutputToolsParser();
const chain = modelWithTool.pipe(parser);

const stream = await chain.stream("详细介绍牛顿的生平和成就")

let lastContent = ""; // 记录已打印的完整内容

try {
  for await (const chunk of stream) {
    if (chunk.length > 0) {
      const toolCall = chunk[0];
  
      // 获取当前工具调用的完整参数内容
      const currentContent = JSON.stringify(toolCall.args || {}, null, 2);
  
      if (currentContent.length > lastContent.length) {
          const newText = currentContent.slice(lastContent.length);
          process.stdout.write(newText); // 实时输出到控制台
          lastContent = currentContent; // 更新已读进度
      }
  
      console.log(toolCall.args);
    }
  }
  console.log("\n\n✅ 流式输出完成");
} catch (error) {
  console.error("\n❌ 错误:", error.message);
}