import { z } from 'zod'
import { ChatPromptTemplate }  from "@langchain/core/prompts"

export const QueryAugment = z.object({
  queries: z.array(z.string()).length(3).describe('3条不同角度的检索问句')
})


const AUGMENT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', '将用户问题改写为3条不同角度的检索问句，保留专有名词。'],
  ['human', '{query}']
])


export async function augmentQuery(chatModel, query) {
  const structured = chatModel.withStructuredOutput(QueryAugment)
  const chain = AUGMENT_PROMPT.pipe(structured)
  const res = await chain.invoke({ query })
  return { queries: res.queries }
}
