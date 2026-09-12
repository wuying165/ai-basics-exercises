import "dotenv/config"
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables"


const clean = RunnableLambda.from((text) => text.trim().replace(/\s+/g, " "))
const tokenize = RunnableLambda.from((text) => text.split(" "))
const count = RunnableLambda.from((tokens) => ({ tokens, wordCount: tokens.length }))

const chain = RunnableSequence.from([ clean, tokenize, count ])

const callback = {
  handleChainStart: (chain) => console.log('开始', chain?.id?.[chain.id.length - 1] ?? "unknown"),
  handleChainEnd: (output) => console.log('结束', output),
  handleChainError: (error) => console.log(`[ERROR] ${error.message}\n`)
}


const result = await chain.invoke("  hello   world   from   langchain ", { callbacks: [callback] })
console.log("结果:", result)
