import "dotenv/config"
import { RunnableLambda } from "@langchain/core/runnables"

const premiumTranslator = RunnableLambda.from(async (text) => {
  console.log("[Premium] 尝试翻译...")

  throw new Error("Premium 服务超时")
})

const standardTranslator = RunnableLambda.from(async (text) => {
  console.log("[Standard] 尝试翻译...")

  throw new Error("Standard 服务超时")
})

const localTranslator = RunnableLambda.from(async (text) => {
  console.log("[Local] 使用本地词典翻译...")

  const dict = { hello: "你好", world: "世界", goodbye: "再见" };
  const words = text.toLowerCase().split(" ")
  return words.map((w) => dict[w] ?? w).join("")
})

const translator = premiumTranslator.withFallbacks({
  fallbacks: [standardTranslator, localTranslator]
})

const result = await translator.invoke("hello world")
console.log("翻译结果:", result);

 