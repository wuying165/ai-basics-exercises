import path from "node:path";
import { fileURLToPath } from "node:url";
import dedent from "dedent";
import { ChatOpenAI } from "@langchain/openai";
import { createCodeInterpreterMiddleware } from "@langchain/quickjs";
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { webSearch } from "./tools/search.mjs";

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ================= 子 Agent 团队声明 =================
const researcherSubAgent = {
  name: "researcher",
  description: "负责联网调研单一子主题。自动通过 write_todos 拆解步骤，结果写入 findings_*.md",
  systemPrompt: dedent`你搜集资料后，必须调用 write_file 一次保存到 /workspace/sources/findings_*.md，随后立刻停止。`,
  tools: [webSearch]
};

const analystSubAgent = {
  name: "analyst",
  description: "负责数值计算与数据表排名对比。禁止口算猜测。",
  systemPrompt: dedent`你必须通过 eval REPL 执行 JavaScript 代码完成计算，结果写入 /workspace/sources/analysis_*.md。`,
  middleware: [createCodeInterpreterMiddleware()] // 核心：注入 QuickJS 沙箱中间件
};

const editorSubAgent = {
  name: "editor",
  description: "审阅报告草稿的准确性与逻辑性。在 draft_*.md 完成后介入。",
  systemPrompt: dedent`你只输出具体修改建议，严禁亲自改写文件。审阅与修订必须分离。`
};

// ================= 主 Agent 引擎创建 =================
export function createIntelligenceDeskAgent() {
  const backend = new FilesystemBackend({ rootDir, virtualMode: true });

  return createDeepAgent({
    model: new ChatOpenAI({ 
      model: process.env.MODEL_NAME ?? "qwen-plus", 
      temperature: 0, 
      apiKey: process.env.OPENAI_API_KEY, 
      configuration: { baseURL: process.env.OPENAI_BASE_URL } 
    }),
    systemPrompt: dedent`你是深度调研助手主脑。严格遵循：①规划(write_todos) -> ②调研(task委派) -> ③分析(可选) -> ④起草(自己写) -> ⑤审阅(委派) -> ⑥定稿。`,
    backend,
    subagents: [researcherSubAgent, analystSubAgent, editorSubAgent], // 托管团队
    memory: [path.join(rootDir, "AGENTS.md")],                        // 绑定长期记忆文件
    skills: ["/skills/"]                                              // 导入指令技能包
  });
}
