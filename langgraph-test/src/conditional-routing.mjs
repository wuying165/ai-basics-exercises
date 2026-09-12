import "dotenv/config"
import { StateGraph, Annotation, START, END } from "@langchain/langgraph";


const StateAnnotation = Annotation.Root({
  query: Annotation({ reducer: (_prev, next) => next, default: () => "" }),
  route: Annotation({ reducer: (_prev, next) => next, default: () => "chat" }),
  answer: Annotation({ reducer: (_prev, next) => next, default: () => "" }),
})

const router = (state) => {
  const isMath =  /[+\-*/]/.test(state.query);
  return {route:isMath ? 'math' : 'chat'}
} 

const mathNode = (state) => {
  try {
    return { answer: eval(state.query).toString() };
  } catch (error) {
    return { answer: "表达式无法计算" };
  }
}

const chatNode = (state) => ({ answer: `你说的是：${state.query}` })

const graph = new StateGraph(StateAnnotation)
  .addNode('router', router)
  .addNode('math', mathNode)
  .addNode('chat', chatNode)
  .addEdge(START, 'router')
  .addConditionalEdges("router", (state) => state.route, {'math': 'math', 'chat': 'chat'})
  .addEdge('math', END)
  .addEdge('chat', END)
  .compile()

const result = await graph.invoke({ query: '1+2' })
console.log('result', result)

const result2 = await graph.invoke({ query: '你好' })
console.log('result2', result2)
