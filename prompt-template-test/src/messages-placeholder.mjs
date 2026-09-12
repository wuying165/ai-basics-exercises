import 'dotenv/config';
import { ChatOpenAI } from'@langchain/openai';
import { ChatPromptTemplate, MessagesPlaceholder } from'@langchain/core/prompts';

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const chatPromptWithHistory = ChatPromptTemplate.fromMessages([
  [
    'system',
    `你是一名资深工程效率顾问，善于在多轮对话的上下文中给出具体、可执行的建议。`,
  ],
  new MessagesPlaceholder('history'),
  [
    'human',
    `这是用户本轮的新问题：{current_input}

    请结合上面的历史对话，一并给出你的建议。`,
  ]
])

const historyMessages = [
  {
    role: 'human',
    content: '我们团队最近在做一个内部的周报自动生成工具。',
  },
  {
    role: 'ai',
    content:
      '听起来不错，可以先把数据源（Git / Jira / 运维）梳理清楚，再考虑 Prompt 模块化设计。',
  },
  {
    role: 'human',
    content: '我们已经把 Prompt 拆成了「人设」「背景」「任务」「格式」四块。',
  },
  {
    role: 'ai',
    content:
      '很好，接下来可以考虑把这些模块做成可复用的 PipelinePromptTemplate，方便在不同场景复用。',
  },
]

const chatMessages =  await chatPromptWithHistory.formatPromptValue({
  history: historyMessages,
  current_input: '现在我们想再优化一下多人协同编辑周报的流程，有什么建议？',
})

console.log('C包含历史对话的消息数组：\n', chatMessages.toChatMessages());

const response = await model.invoke(chatMessages)
console.log('\nAI 生成的周报草稿:', response.content)