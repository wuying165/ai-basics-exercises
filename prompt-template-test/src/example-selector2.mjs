import 'dotenv/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { PromptTemplate, FewShotPromptTemplate } from '@langchain/core/prompts';
import { SemanticSimilarityExampleSelector } from '@langchain/core/example_selectors';
import { Milvus } from'@langchain/community/vectorstores/milvus';


const COLLECTION_NAME = 'weekly_report_examples';
const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL
  }
})

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
  model: process.env.EMBEDDINGS_MODEL_NAME,
  configuration: {
      baseURL: process.env.OPENAI_BASE_URL,
    },
  dimensions: VECTOR_DIM,
})

const examplePrompt = PromptTemplate.fromTemplate(`
    用户需求：{user_requirement}
    周报片段示例：
    {report_snippet}
    ---
  `)

const milvusAddress = process.env.MILVUS_ADDRESS ?? 'localhost:19530';

const vectorStore = await Milvus.fromExistingCollection(embeddings,{
  collectionName: COLLECTION_NAME,
  clientConfig: {
    address: milvusAddress,
  },
  indexCreateOptions: {
    index_type: 'IVF_FLAT',
    metric_type: 'COSINE',
    params: { nlist: 1024 },
    search_params: {
      nprobe: 10,
    },
  }
})

const exampleSelector = await SemanticSimilarityExampleSelector({
  vectorStore,
  k: 2,
})

const fewShotPrompt = new FewShotPromptTemplate({
  examplePrompt,
  exampleSelector,
  prefix:
    `下面是一些不同风格和长度的周报片段示例，你可以从中学习语气和结构（系统会自动从 Milvus 选出和当前场景最相近的示例）：\n`,
  suffix:
    '\n\n现在请根据上面的示例风格，为下面这个场景写一份新的周报：\n' +
    '场景描述：{current_requirement}\n' +
    '请输出一份适合发给老板和团队同步的 Markdown 周报草稿。',
  inputVariables: ['current_requirement'],
})

const currentScenario1 =
  '我们本周主要是在清理历史技术债：重构老旧的订单模块、补齐核心接口的单测，' +
  '同时也完善了一些文档，方便后面新人接手。整体没有对外大范围发布的新功能。';

// 一个语义上明显不同的场景：偏「首发上线 + 对外宣传」
const currentScenario2 =
  '本周完成新一代运营看板的首批功能上线，重点打通埋点和实时数仓链路，' +
  '并面向运营和市场同学做了多场宣讲，希望更多同学开始使用新能力。';

console.log('\n===== 场景 1：技术债清理为主 =====\n');
const finalPrompt1 = await fewShotPrompt.format({
  current_requirement:  currentScenario1
})

console.log(finalPrompt1);

console.log('\n\n===== 场景 2：新功能首发 + 对外宣传 =====\n');
const finalPrompt2 = await fewShotPrompt.format({
  current_requirement: currentScenario2,
});
console.log(finalPrompt2);
