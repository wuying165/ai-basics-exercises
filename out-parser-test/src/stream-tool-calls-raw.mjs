import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
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
  name: z.string().describe("姓名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().describe("去世年份"),
  nationality: z.string().describe("国籍"),
  occupation: z.string().describe("职业"),
  famous_works: z.array(z.string()).describe("著名作品列表"),
  biography: z.string().describe("简短传记")
})

// 3. 绑定工具到模型
const modelWithTool = model.bindTools([{
  name: "extract_data_info",
  description: "提取和结构化科学家的详细信息",
  schema: dataSchema
}])


async function main() {
  try {
    // 开启流式输出
    const stream = await modelWithTool.stream("详细介绍牛顿的生平和成就")

    console.log("📡 实时输出流式 tool_calls_chunk:\n");

    let chunkIndex = 0
    for await (const chunk of stream) {
      chunkIndex++

      if (chunk.tool_call_chunks && chunk.tool_call_chunks.length > 0) {
        for (const tc of chunk.tool_call_chunks) {
          const args = tc?.args
          if (args === null || args === undefined) continue
          process.stdout.write(typeof args === 'string' ? args : JSON.stringify(args))
        }
      }
    }

    console.log("\n\n✅ 流式输出完成");
  } catch (error) {
    console.error("\n❌ 错误:", error.message);
  }
}

main()