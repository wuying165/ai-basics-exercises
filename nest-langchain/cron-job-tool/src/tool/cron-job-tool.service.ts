/* eslint-disable no-case-declarations */
import { tool } from '@langchain/core/tools';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { JobService } from 'src/job/job.service';
import z from 'zod';

@Injectable()
export class CronJobToolService {
  readonly tool;

  constructor(private readonly moduleRef: ModuleRef) {
    const schema = z.object({
      action: z.enum(['list', 'add', 'toggle']).describe('操作类型'),
      id: z.string().optional().describe('任务 ID（toggle 时需要）'),
      enabled: z.boolean().optional().describe('是否启用（toggle 可选）'),
      type: z
        .enum(['cron', 'every', 'at'])
        .optional()
        .describe('任务类型（add 时需要）'),
      instruction: z.string().optional().describe('任务指令（add 时需要）'),
      cron: z.string().optional().describe('Cron 表达式（type=cron 时需要）'),
      everyMs: z.number().optional().describe('间隔毫秒（type=every 时需要）'),
      at: z
        .string()
        .optional()
        .describe('执行时间点（type=at 时需要，ISO 字符串）'),
    });

    this.tool = tool(
      async (args) => {
        const jobService = this.moduleRef.get(JobService, { strict: false });
        switch (args.action) {
          case 'list':
            const jobs = await jobService.listJobs();
            if (!jobs.length) return '当前没有任何定时任务。';
            return jobs
              .map(
                (j) =>
                  `id=${j.id} type=${j.type} enabled=${j.isEnabled} running=${j.running} instruction=${j.instruction}`,
              )
              .join('\n');

          case 'add':
            if (!args.type) return '新增任务需要提供 type';
            if (!args.instruction) return '新增任务需要提供 instruction';

            if (args.type === 'cron') {
              if (!args.cron) return 'type=cron 需要提供 cron';
              const created = await jobService.addJob({
                type: 'cron',
                instruction: args.instruction,
                cron: args.cron,
                isEnabled: true,
              });
              return `已新增定时任务：id=${created.id} type=${created.type}`;
            }

            if (args.type === 'every') {
              if (!args.everyMs) return 'type=every 需要提供 everyMs';
              const created = await jobService.addJob({
                type: 'every',
                instruction: args.instruction,
                everyMs: args.everyMs,
                isEnabled: true,
              });
              return `已新增定时任务：id=${created.id} type=${created.type}`;
            }

            // args.type === 'at'
            if (!args.at) return 'type=at 需要提供 at';
            const created = await jobService.addJob({
              type: 'at',
              instruction: args.instruction,
              at: new Date(args.at),
              isEnabled: true,
            });
            return `已新增定时任务：id=${created.id} type=${created.type}`;

          case 'toggle':
            if (!args.id) return 'toggle 需要提供 id';
            const updated = await jobService.toggleJob(args.id, args.enabled);
            return `已更新任务状态：id=${updated.id} enabled=${updated.isEnabled}`;
        }
      },
      {
        name: 'cron_job',
        description: '管理服务端定时任务（支持 list/add/toggle）',
        schema,
      },
    );
  }
}
