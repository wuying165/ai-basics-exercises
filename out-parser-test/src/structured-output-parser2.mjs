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
  name: z.string().describe("科学家的全名"),
  birth_year: z.number().describe("出生年份"),
  death_year: z.number().optional().describe("去世年份，如果还在世则不填"),
  nationality: z.string().describe("国籍"),
  fields: z.array(z.string()).describe("研究领域列表"),
  awards: z.array(
      z.object({
          name: z.string().describe("奖项名称"),
          year: z.number().describe("获奖年份"),
          reason: z.string().optional().describe("获奖原因")
      })
  ).describe("获得的重要奖项列表"),
  major_achievements: z.array(z.string()).describe("主要成就列表"),
  famous_theories: z.array(
      z.object({
          name: z.string().describe("理论名称"),
          year: z.number().optional().describe("提出年份"),
          description: z.string().describe("理论简要描述")
      })
  ).describe("著名理论列表"),
  education: z.object({
      university: z.string().describe("主要毕业院校"),
      degree: z.string().describe("学位"),
      graduation_year: z.number().optional().describe("毕业年份")
  }).optional().describe("教育背景"),
  biography: z.string().describe("简短传记，100字以内")
})

try {
  const parser = StructuredOutputParser.fromZodSchema(dataSchema)
  const question = `请介绍一下居里夫人（Marie Curie）的详细信息，包括她的教育背景、研究领域、获得的奖项、主要成就和著名理论。

${parser.getFormatInstructions()}`;
  console.log('📋 生成的提示词:\n', question)

  const res = await model.invoke(question)
  console.log("📤 模型原始响应:\n", res.content);

  const result = await parser.parse(res.content)
  console.log("✅ StructuredOutputParser 自动解析并验证的结果:\n", JSON.stringify(result, null, 2));
} catch (error) {
  console.error("❌ 错误:", error.message);
  if (error.name === 'ZodError') {
      console.error("验证错误详情:", error.errors);
  }
} 

