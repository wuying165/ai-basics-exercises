import "dotenv/config"
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Milvus } from "@langchain/community/vectorstores/milvus";

const llm = new ChatOpenAI({
  model: process.env.MODEL_NAME ?? "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
});

const embeddings = new OpenAIEmbeddings({
  model: process.env.EMBEDDING_MODEL ?? "text-embedding-v3",
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
})

const vectorStore = await Milvus.fromExistingCollection(embeddings,{
  collectionName: process.env.MILVUS_COLLECTION ?? "rag_docs",
  url: process.env.MILVUS_URI ?? "http://localhost:19530",
})

const retriever = vectorStore.asRetriever({ k: 3 })

const prompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    "你是客服助手。仅根据下面「上下文」回答；上下文没有的信息请明确说不知道，不要编造。\n\n上下文：\n{context}",
  ],
  ["human", "{question}"],
]);

const chain = RunnableSequence.from([prompt, llm, new StringOutputParser()]);

const GraphState = Annotation.Root({ question: Annotation, context: Annotation, answer: Annotation });


async function retrieve(state) {
  const docs = await retriever.invoke(state.question)
  return { context: docs }
}

async function generate(state) {
  const answer = await chain.invoke({
    context: state.context.map((d) => d.pageContent).join("\n\n"),
    question: state.question,
  });
  return { answer }; 
}

const workflow = new StateGraph(GraphState).addNode("retrieve", retrieve).addNode("generate", generate).addEdge(START, "retrieve").addEdge("retrieve", "generate").addEdge("retrieve", END)

export const ragAgent = workflow.compile()

export async function ask(question) {
const result = await ragAgent.invoke({ question });
  return {
    answer: result.answer,
    context: result.context ?? [],
  };
}
