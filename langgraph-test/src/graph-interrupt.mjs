import { createInterface } from "node:readline/promises"
import { StateGraph, Annotation, START, END, MemorySaver, interrupt, Command } from "@langchain/langgraph";



const StateAnnotation = Annotation.Root({
  actionSummary: Annotation({ reducer: (_prev, next) => next, default: () => "" }),
  userInput: Annotation({ reducer: (_prev, next) => next, default: () => "" }),
}) 

const showTransfer = () => {
  return { actionSummary: "向张三转账 ¥100（模拟，不会真扣款）" }
}

const waitConfirm = (state) => {
  const text = interrupt({
    hint: "终端里输入「确认」或备注后回车，图才会继续",
    actionSummary: state.actionSummary
  })
  return { userInput: String(text) }
}

const graph = new StateGraph(StateAnnotation)
  .addNode('showTransfer', showTransfer)
  .addNode('waitConfirm', waitConfirm)
  .addEdge(START, 'showTransfer')
  .addEdge('showTransfer', 'waitConfirm')
  .addEdge('waitConfirm', END)
  .compile({ checkpointer: new MemorySaver() })

const config = { configurable: { thread_id: '123' }}

const paused = await graph.invoke({}, config)
console.log('paused', paused)

const rl = createInterface({ input: process.stdin, output: process.stdout })
const line = (await rl.question('请输入：')).trim()
await rl.close()


if (!line) {
  console.log('用户未输入，退出。')
  process.exit(1)
}

const done = await graph.invoke(new Command({ resume: line }), config)
console.log('done', done)
