import 'dotenv/config';
import { RunnableSequence, RunnableLambda, RunnableEach } from "@langchain/core/runnables";

const toUpperCase = RunnableLambda.from((input) => input.toUpperCase())
const reverseText = RunnableLambda.from((input) => input.split("").reverse().join(""))

const processItem = RunnableSequence.from([toUpperCase, reverseText])

const chain = new RunnableEach({ bound: processItem })
const input = ["alice", "bob", "carol"];
const result = await chain.invoke(input);

console.log('✅ RunnableEach - 数组元素处理:');
console.log('输入:', input);
console.log('输出:', result);