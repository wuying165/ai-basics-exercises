import "dotenv/config"
import { RunnableBranch } from "@langchain/core/runnables"

const branch = RunnableBranch.from([
  [(x) => x > 0, (x) => `正数: ${x}`],
  [(x) => x < 0, (x) => `负数: ${x}`],
  (x) => `默认: ${x}` // 默认分支
]);

for (const item of [5, -3, 4]) {
  const result = await branch.invoke(item)
  console.log(`输入: ${item} => ${result}`)
}