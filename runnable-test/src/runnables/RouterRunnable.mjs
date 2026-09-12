import 'dotenv/config';
import { RouterRunnable, RunnableLambda } from "@langchain/core/runnables";

const toUpperCase = RunnableLambda.from((input) => input.toUpperCase())
const reverseText = RunnableLambda.from((input) => input.split("").reverse().join(""))


const router = new RouterRunnable({
  runnables: { toUpperCase, reverseText }
})

const result1 = await router.invoke({ key: 'reverseText', input: "Hello World" })
const result2 = await router.invoke({ key: "toUpperCase", input: "Hello World"  })

console.log('result1:', result1, "result2:", result2)