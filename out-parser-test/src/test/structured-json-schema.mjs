import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
import { z } from'zod';
import { zodToJsonSchema } from"zod-to-json-schema";
import { HumanMessage, SystemMessage } from'@langchain/core/messages';


const schema = z.object({
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  field: z.string().describe("主要研究领域"),
  achievements: z.array(z.string()).describe("主要成就列表")
}).strict();
  

// 将 Zod 转换为原生的 JSON Schema 格式
const nativeJsonSchema = zodToJsonSchema(schema);

const model = new ChatOpenAI({
  modelName: "qwen-max",
  temperature: 0,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
  modelKwargs: {
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'scientist', schema: nativeJsonSchema }
    }
  }
});

async function test() {
  console.log("🧪 测试原生 JSON Schema 模式...\n");
  const res = await model.invoke([
    new SystemMessage("你是一个信息提取助手，请直接返回 JSON 数据。"),
    new HumanMessage("介绍一下杨振宁")
  ])

  const data = JSON.parse(res.content)
  console.log("\n✅ 收到响应 (纯净 JSON):", res.content)
  console.log("\n📋 解析后的对象:", data)
}

test()