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

const prompt = `详细介绍莫扎特的信息。`;

async function main() {
  try {
    const structuredModel = await model.withStructuredOutput(dataSchema)
    const stream = await structuredModel.stream(prompt)
    
    let fullContent = null
    let chunkCount = 0

    for await (const chunk of stream) {
      chunkCount++
      fullContent = chunk

      console.log(`[Chunk ${chunkCount}]`);
      console.log(JSON.stringify(chunk, null, 2));
    }

    if (fullContent) {
      console.log("📊 最终结构化结果:\n", JSON.stringify(fullContent, null, 2));
    }

    console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);
    
  } catch (error) {
    console.error("\n❌ 错误:", error.message);
  }
}

main()