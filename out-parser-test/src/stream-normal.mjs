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

const prompt = `详细介绍莫扎特的信息。`;

async function main() {
  try {
    const stream = await model.stream(prompt)
    
    let fullContent = ""
    let chunkCount = 0

    for await (const chunk of stream) {
      chunkCount++
      fullContent += chunk.content

      process.stdout.write(chunk.content)
    }

    console.log(`\n\n✅ 共接收 ${chunkCount} 个数据块\n`);
    console.log(`📝 完整内容长度: ${fullContent.length} 字符`);
    
  } catch (error) {
    console.error("\n❌ 错误:", error.message);
  }
}

main()