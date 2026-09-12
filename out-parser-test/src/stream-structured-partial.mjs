import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
import { StructuredOutputParser } from'@langchain/core/output_parsers';
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



async function main() {
  try {
    const parser = StructuredOutputParser.fromZodSchema(dataSchema)

    const prompt = `详细介绍莫扎特的信息。\n\n${parser.getFormatInstructions()}`;
    const stream = await model.stream(prompt)
    
    let fullContent = ''
    let chunkCount = 0

    for await (const chunk of stream) {
      chunkCount++
      fullContent += chunk.content

      process.stdout.write(chunk.content) // 实时显示流式文本
    }

    console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);

    // 解析完整内容为结构化数据
    const result = await parser.parse(fullContent)

    console.log("📊 解析后的结构化结果:\n", JSON.stringify(result, null, 2));    
  } catch (error) {
    console.error("\n❌ 错误:", error.message);
  }
}

main()