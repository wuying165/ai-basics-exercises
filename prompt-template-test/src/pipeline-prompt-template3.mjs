import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
import { PipelinePromptTemplate, PromptTemplate, ChatPromptTemplate } from'@langchain/core/prompts';
import { personaPrompt, contextPrompt } from'./pipeline-prompt-template.mjs';

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const weeklyTaskPrompt = PromptTemplate.fromTemplate(`
    
  `)

const weeklyFormatPrompt = PromptTemplate.fromTemplate(`
    
  `)

const finalPrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一名资深工程团队负责人，擅长把复杂的技术细节总结成结构化、易读的周报。
  
  下面是一些已经预先整理好的信息块，请你综合理解后，再根据用户补充的信息生成周报。`,
    ],
    [
      'human',
      `人设与写作风格：
  {persona_block}
  
  团队与本周背景：
  {context_block}
  
  任务与输入数据：
  {task_block}
  
  输出格式要求：
  {format_block}
  
  现在请基于以上信息，直接输出最终的周报内容。`,
    ],
  ]);

const pipelinePrompt = new PipelinePromptTemplate({
  pipelinePrompts: [
    { name: 'persona_block', prompt: personaPrompt },
    { name: 'content_block', prompt: contextPrompt },
    { name: 'task_block', prompt: weeklyTaskPrompt },
    { name: 'format_block', prompt: weeklyFormatPrompt }
  ],
  finalPrompt,
  inputVariables: [
    'tone',
    'company_name',
    'team_name',
    'manager_name',
    'week_range',
    'team_goal',
    'dev_activities',
  ],
})

const pipelineFormatted = await pipelinePrompt.formatPromptValue({
  tone: '专业、清晰、略带鼓励',
  company_name: '星航科技',
  team_name: 'AI 平台组',
  manager_name: '王总',
  week_range: '2025-05-12 ~ 2025-05-18',
  team_goal: '完成周报自动生成能力的灰度验证，并收集团队反馈。',
  dev_activities:
    '- Git：本周合并 4 个主要特性分支，包含 Prompt 配置化和日志观测优化\n' +
    '- Jira：关闭 9 个 Story / 5 个 Bug，新增 2 个 TechDebt 任务\n' +
    '- 运维：本周线上 P1 事故 0 起，P2 1 起（由配置变更引起，已完成复盘）\n' +
    '- 其他：完成与数据平台、运维平台两次联合评审会议',
})

console.log('Pipeline + ChatPromptTemplate 生成的消息:\n', promptValue.toChatMessages());

const response = await model.invoke(pipelineFormatted)
console.log('\nAI 生成的周报内容:\n', response.content)