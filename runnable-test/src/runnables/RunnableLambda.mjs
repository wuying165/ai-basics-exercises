import "dotenv/config"
import { RunnableLambda, RunnableSequence } from"@langchain/core/runnables";

const addOne = RunnableLambda.from((input) => input + 1)
const multiplyTwo = RunnableLambda.from((input) => input * 2)


const chain = RunnableSequence.from([
  addOne,
  multiplyTwo,
  addOne,
])

const result = await chain.invoke(5)
console.log(result)

// const result = await addOne.invoke(5)
// console.log(result)