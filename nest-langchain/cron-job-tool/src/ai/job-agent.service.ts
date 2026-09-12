/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';
import { Inject, Injectable, Logger } from '@nestjs/common';

@Injectable()
export class JobAgentService {
  private tools: any[];
  private readonly logger = new Logger(JobAgentService.name);
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
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
    @Inject('CRON_JOB_TOOL') private readonly cronJobTool: any,
    @Inject('TIME_NOW_TOOL') private readonly timeNowTool: any,
  ) {
    this.tools = [
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
      this.cronJobTool,
      this.timeNowTool,
    ];
    this.modelWithTools = model.bindTools(this.tools);
  }

  async runJob(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个用于执行后台任务的智能代理。你会根据给定的任务指令，必要时调用工具（如 db_users_crud、send_mail、web_search、time_now 等）来查询或改写数据，然后给出清晰的步骤和结果说明。',
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
}
