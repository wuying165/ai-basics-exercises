import "dotenv/config"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "node:url"
import { ChatOpenAI } from "@langchain/openai"
import { createAgent, HumanMessage } from "langchain";
import { createFilesystemMiddleware, FilesystemBackend } from "deepagents";


const workspaceDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "workspace")

const permissions = [
  { operations: ["read"], paths: ["/secret.txt"], mode: "deny" },
  { operations: ["write"], paths: ["/todo.md"], mode: "allow" },
  { operations: ["write"], paths: ["/**"], mode: "deny" },
];

fs.rmSync(workspaceDir, { recursive: true, force: true })
fs.mkdirSync(workspaceDir)
fs.writeFileSync(path.join(workspaceDir, "secret.txt"), "机密：不得读取", "utf8")

const model = new ChatOpenAI({
  model: process.env.MODEL_NAME ?? "qwen-plus",
  apiKey: process.env.OPENAI_API_KEY,
  temperature: 0,
  configuration: { baseURL: process.env.OPENAI_BASE_URL },
})

const agent = createAgent({
  model,
  tools: [],
  systemPrompt:"工作区根路径为 /。用 ls、read_file、write_file、edit_file 操作文件，路径以 / 开头。中文回答。",
  middleware: [
    createFilesystemMiddleware({
      backend: new FilesystemBackend({ rootDir: workspaceDir, virtualMode: true }),
      permissions,
    })
  ]
})


async function run(label, prompt) {
  console.log(`\n=== ${label} ===\n`, prompt, "\n");
  const { messages } = await agent.invoke({ message: [new HumanMessage(prompt)]}, { recursionLimit: 20 })
  
  for (const msg of messages) {
   for (const t of msg.tool_calls ?? []) console.log("→", t.name);
  }

  console.log("回复:", messages.at(-1)?.content);
}

async function expectDenied(label, prompt) {
  console.log(`\n=== ${label}（预期拒绝）===\n`, prompt, "\n");
  try {
    await agent.invoke({ messages: [new HumanMessage(prompt)] }, { recursionLimit: 5 })
    console.log("未触发拒绝（异常）");
  } catch (error) {
    console.log("✗", error.cause?.message ?? error.message);
  }
}

await run("允许的操作","write_file 创建 /todo.md（三条待办），edit_file 把第一条标为完成，ls /，一句话总结。")
await expectDenied("禁止读", "只调用 read_file，路径 /secret.txt。");
await expectDenied("禁止写", "只调用 write_file，路径 /hack.txt，内容 test。");