import { StateGraph, Annotation, START, END, MemorySaver } from "@langchain/langgraph";

const StateAnnotation = Annotation.Root({
  visitCount: Annotation({ reducer: (_prev, next) => next, default: () => 0 }),
  message: Annotation({ reducer: (_prev, next) => next, default: () => "" }),
})


const recordVisit = (state) => {
  const visitCount = state.visitCount + 1
  const message =
    visitCount === 1
      ? "这是你在本会话里第 1 次进入。"
      : `这是你在本会话里第 ${visitCount} 次进入`;
  return { visitCount,  message }
}

const graph = new StateGraph(StateAnnotation).addNode('recordVisit', recordVisit).addEdge(START, 'recordVisit').addEdge('recordVisit', END)

const checkpointer = new MemorySaver()
const app = graph.compile({ checkpointer })

const user1 = { configurable: { thread_id: 'user1' } }
const user2 = { configurable: { thread_id: 'user2' } }

const result1 = await app.invoke({}, user1)
const result2 = await app.invoke({}, user1)
const result3 = await app.invoke({}, user1)
const result4 = await app.invoke({}, user2)

console.log('result1', result1)
console.log('result2', result2)
console.log('result3', result3)
console.log('result4', result4)
