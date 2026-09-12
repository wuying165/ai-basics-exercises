import "dotenv/config"
import { RunnableMap, RunnableLambda } from "@langchain/core/runnables"
import { PromptTemplate } from "@langchain/core/prompts"


const addOne = RunnableLambda.from((input) => input.num + 1)
const multiplyTwo = RunnableLambda.from((input) => input.num * 2)
const square = RunnableLambda.from((input) => input.num * input.num)

const greetTemplate = PromptTemplate.fromTemplate("你好，{name}！")
const weatherTemplate = PromptTemplate.fromTemplate("今天天气{weather}。")

const runnableMap = RunnableMap.from({
  addOne,
  multiplyTwo,
  square,

  greetTemplate,
  weatherTemplate,
})

const input = { num: 5, name: "张三", weather: "晴" }

const result = await runnableMap.invoke(input)
console.log(result)