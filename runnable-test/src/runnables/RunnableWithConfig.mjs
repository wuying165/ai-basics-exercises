import "dotenv/config"
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables"


const mockUsers = new Map([
  [
    "user-123",
    {
      id: "user-123",
      name: "张三",
      email: "zhangsan@example.com",
    },
  ],
]);
const fetchUserFromConfig = RunnableLambda.from(async (input, config) => {
  const userId = config?.configurable?.userId;

  const user = userId ? mockUsers.get(userId) : null;
  if (!user) throw new Error("未找到用户，无法发送通知");

  return { user, notification: input };
})
const checkPermissionByRole = RunnableLambda.from(async (state, config) => {
  const role = config?.configurable?.role ?? "普通用户"

  const canSend = role === "管理员" || role === "运营" || role === "系统";
  if (!canSend) throw new Error(`角色「${role}」无权限发送系统通知`);

  return { ...state, role }
})
const formatNotificationByLocale = RunnableLambda.from(async (state, config) => {
  const locale = config?.configurable?.locale ?? "zh-CN"

  const content = locale === "en-US" 
    ? `Dear ${state.user.name},\n\n${state.notification}\n\n(from role: ${state.role})`
    : `亲爱的 ${state.user.name}，\n\n${state.notification}\n\n（发送人角色：${state.role}）`

  return { ...state, locale, finalContent: content }
})

const chain = RunnableSequence.from([ fetchUserFromConfig, checkPermissionByRole, formatNotificationByLocale ])

const withConfig = chain.withConfig({
  tags: ["demo", "withConfig", "notification"],
  metadata: { demoName: "RunnableWithConfig" },
  configurable: { userId: "user-123", role: "管理员", locale: "zh-CN" }
})

const withConfig1 = chain.withConfig({
  tags: ["demo", "withConfig", "notification-en"],
  metadata: { demoName: "RunnableWithConfig2"  },
  configurable: { userId: "user-123", role: "运营", locale: "en-US",  },
})

const result = await withConfig.invoke("你有一条新的系统通知，请及时查看。")
console.log("✅ 最终通知内容:\n", result.finalContent)

const result2 = await withConfig1.invoke("System maintenance scheduled tonight.");
console.log("✅ 最终通知内容:\n", result2.finalContent);