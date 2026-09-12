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

const res = await modelWithTool.invoke("介绍一下爱因斯坦")
console.log('res.tool_calls:',res.tool_calls)

const result = res.tool_calls[0].args
console.log("结构化结果:", JSON.stringify(result, null, 2));
console.log(`\n姓名: ${result.name}`);
console.log(`出生年份: ${result.birth_year}`);
console.log(`国籍: ${result.nationality}`);
console.log(`研究领域: ${result.fields.join(', ')}`);