import 'dotenv/config';
import { RunnablePick, RunnableSequence } from "@langchain/core/runnables";

const data = {
  name: "张三",
  age: 30,
  city: "北京",
  country: "中国",
  email: "zhangsan@example.com",
  phone: "+86-18199990000",
};

const chain = RunnableSequence.from([
  (input) => ({ ...input, fullInfo: `${input.name}，${input.age}岁，来自${input.city}` }),
  new RunnablePick(["name", "fullInfo"])
])

const result = await chain.invoke(data)
console.log(result)