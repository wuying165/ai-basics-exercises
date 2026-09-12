import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
import { StructuredOutputParser } from'@langchain/core/output_parsers';

// 1. 初始化模型
const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

// 2. 定义输出结构
const parser = StructuredOutputParser.fromNamesAndDescriptions({
  name: "姓名",
  birth_year: "出生年份",
  nationality: "国籍",
  major_achievements: "主要成就，用逗号分隔的字符串",
  famous_theory: "著名理论"
})

const question = `请介绍一下爱因斯坦的信息。

${parser.getFormatInstructions()}`; 

async function main() {
  try {
    const res = await model.invoke(question)
    console.log("📤 模型原始响应:\n", res.content)

    const result = await parser.parse(res.content)
    console.log("\n✅ StructuredOutputParser 自动解析的结果:\n", result);
  } catch (error) {
    console.error("❌ 错误:", error.message);
  }
}

main()