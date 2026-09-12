import 'dotenv/config';
import { RunnablePassthrough, RunnableLambda, RunnableMap, RunnableSequence } from "@langchain/core/runnables"

const chain = RunnableSequence.from([
  (input) => ({ concept: input }),
  // RunnableMap.from({
  //   original: new RunnablePassthrough(),
  //   processed: RunnableLambda.from((obj) => ({
  //     concept: input,
  //     uppser: obj.concept.toUpperCase(),
  //     length: obj.concept.length,
  //   }))
  // })

  RunnablePassthrough.assign({
    original: new RunnablePassthrough(),
    processed: RunnableLambda.from((obj) => ({
      concept: input,
      uppser: obj.concept.toUpperCase(),
      length: obj.concept.length,
    }))
  })
])

const input = "今天 3 月 9 号"
const result = await chain.invoke(input);
console.log(result);