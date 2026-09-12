import { tool } from '@langchain/core/tools';
import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import z from 'zod';

@Injectable()
export class DbUsersCrudToolService {
  readonly tool;
  @Inject(UsersService) private readonly usersService: UsersService;

  constructor() {
    const schema = z.object({
      action: z.enum(['create', 'list', 'get', 'update', 'delete']),
      id: z.number().optional(),
      name: z.string().max(50).optional(),
      email: z.string().email().max(50).optional(),
    });

    this.tool = tool(
      async ({
        action,
        id,
        name,
        email,
      }: {
        action: 'create' | 'list' | 'get' | 'update' | 'delete';
        id?: number;
        name?: string;
        email?: string;
      }) => {
        const requireId = () => {
          if (typeof id !== 'number') {
            throw new Error('缺少参数 id（number）');
          }
          return id;
        };
        const requireName = () => {
          if (typeof name !== 'string' || name.length === 0) {
            throw new Error('缺少参数 name（string）');
          }
          return name;
        };
        const requireEmail = () => {
          if (typeof email !== 'string' || email.length === 0) {
            throw new Error('缺少参数 email（string）');
          }
          return email;
        };

        switch (action) {
          case 'create': {
            const created = await this.usersService.create({
              name: requireName(),
              email: requireEmail(),
            });
            return `已创建用户：ID=${created.id}，姓名=${created.name}`;
          }
          case 'list': {
            const users = await this.usersService.findAll();
            return users.map((u) => `ID=${u.id} 姓名=${u.name}`).join('\n');
          }
          case 'get': {
            const user = await this.usersService.findOne(requireId());
            return user ? `ID=${user.id} 姓名=${user.name}` : '用户不存在';
          }
          case 'update': {
            await this.usersService.update(requireId(), { name, email });
            return `已更新用户 ID=${id}`;
          }
          case 'delete': {
            await this.usersService.remove(requireId());
            return `已删除用户 ID=${id}`;
          }
        }
      },
      {
        name: 'db_users_crud',
        description: '对数据库 users 表执行增删改查操作',
        schema,
      },
    );
  }
}
