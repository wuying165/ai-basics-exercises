/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Inject, Injectable } from '@nestjs/common';
import { Runnable } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  BaseMessage,
  AIMessageChunk,
} from '@langchain/core/messages';

@Injectable()
export class AiService {
  private tools: any[];
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  private coerceToolResultToString(result: unknown): string {
    if (typeof result === 'string') return result;
    if (result == null) return '';
    try {
      return JSON.stringify(result);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return String(result);
    }
  }

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('QUERY_USER_TOOL') private readonly queryUserTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
    @Inject('CRON_JOB_TOOL') private readonly cronJobTool: any,
  ) {
    this.tools = [
      this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
      this.cronJobTool,
    ];
    this.modelWithTools = model.bindTools(this.tools);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        `你是一个通用任务助手，可以根据用户的目标规划步骤，并在需要时调用工具：\`query_user\` 查询或校验用户信息、\`send_mail\` 发送邮件、\`web_search\` 进行互联网搜索、\`db_users_crud\` 读写数据库 users 表、\`cron_job\` 创建和管理定时/周期任务（\`list\`/\`add\`/\`toggle\`），从而实现提醒、定期任务、数据同步等各种自动化需求。

        定时任务类型选择规则（非常重要）：
        - 用户说“X分钟/小时/天后”“在某个时间点”“到点提醒”（一次性）=> 用 \`cron_job\` + \`type=at\`（执行一次后自动停用），\`at\`=当前时间+X 或解析出的时间点
        - 用户说“每X分钟/每小时/每天”“定期/循环/一直”（重复执行）=> 用 \`cron_job\` + \`type=every\`（每次执行），\`everyMs\`=X换算成毫秒
        - 用户给出 Cron 表达式或明确说“用 cron 表达式”（重复执行）=> 用 \`cron_job\` + \`type=cron\`

        在调用 \`cron_job.add\` 创建任务时，需要把用户原始自然语言拆成两部分：一部分是“什么时候执行”（用来决定 type/at/everyMs/cron），另一部分是“要做什么任务本身”。\`instruction\` 字段只能填“要做什么”的那部分文本（保持原语言和原话），不能再改写、翻译或总结。

        当用户请求“在未来某个时间点执行某个动作”（例如“1分钟后给我发一个笑话到邮箱”）时，本轮对话只需要使用 \`cron_job\` 设置/更新定时任务，不要在当前轮直接完成这个动作本身：不要直接调用 \`send_mail\` 给他发邮件，也不要在当前轮就真正“执行”指令，只需把要执行的动作写进 \`instruction\` 里，交给将来的定时任务去跑。

        注意：像“\`1分钟后提醒我喝水\`”，时间相关信息用于计算下一次执行时间，而 \`instruction\` 应该是“提醒我喝水”；本轮不需要立刻提醒。
        `,
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const res = await this.modelWithTools.invoke(messages);
      messages.push(res);

      if (!res.tool_calls?.length) return res.content as string;

      for (const call of res.tool_calls) {
        const tool = this.tools.find((t) => t.name === call.name);
        if (!tool) continue;
        const result = await tool.invoke(call.args);
        messages.push(
          new ToolMessage({
            tool_call_id: call.id || '',
            content: this.coerceToolResultToString(result),
          }),
        );
      }
    }
  }

  async *runChainStream(query: string): AsyncIterable<string> {
    const messages: BaseMessage[] = [
      new SystemMessage('你是一个智能助手，可以调用工具回答问题'),
      new HumanMessage(query),
    ];

    while (true) {
      const stream = await this.modelWithTools.stream(messages);
      let fullMsg: AIMessageChunk | null = null;

      for await (const chunkRaw of stream as AsyncIterable<AIMessageChunk>) {
        const chunk = chunkRaw;
        fullMsg = fullMsg ? fullMsg.concat(chunk) : chunk;

        if (!fullMsg?.tool_call_chunks?.length && chunk.content) {
          yield chunk.content as string;
        }
      }

      if (!fullMsg) return;
      messages.push(fullMsg);

      const toolCalls = fullMsg.tool_calls ?? [];
      if (!toolCalls.length) return;

      for (const call of toolCalls) {
        const tool = this.tools.find((t) => t.name === call.name);
        if (!tool) continue;
        const result = await tool.invoke(call.args);
        messages.push(
          new ToolMessage({
            tool_call_id: call.id || '',
            content: this.coerceToolResultToString(result),
          }),
        );
      }
    }
  }
}
