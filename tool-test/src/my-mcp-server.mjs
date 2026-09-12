import { McpServer } from'@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from'@modelcontextprotocol/sdk/server/stdio.js';
import { z } from'zod';

// 模拟数据库
const database = {
  users: {
    '001': { id: '001', name: '张三', email: 'zhangsan@example.com', role: 'admin' },
    '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
    '003': { id: '003', name: '王五', email: 'wangwu@example.com', role: 'user' },
  }
}

const server = new McpServer({
  name: 'my-mcp-server',
  version: '1.0.0',
});

// 注册工具
server.registerTool('query_user', {
  description: '查询用户信息',
  inputSchema: z.object({
    id: z.string().describe('用户ID'),
  }),
}, async ({ id }) => {
  const user = database.users[id];

  console.log(`[查询用户] ${id}`, user);
  if (!user) {
    return {
      content: [{ type: 'text', text: '用户不存在' }],
    };
  }
  return {
    content: [
      {
        type: 'text',
        text: `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`,
      },
    ],
  };
});

server.registerResource('使用指南', 'docs://guide', {
  description: 'MCP Server 使用文档',
  mimeType: 'text/plain',
  }, async () => {
  return {
      contents: [
        {
          uri: 'docs://guide',
          mimeType: 'text/plain',
          text: `MCP Server 使用指南
  
  功能：提供用户查询等工具。
  
  使用：在 Cursor 等 MCP Client 中通过自然语言对话，Cursor 会自动调用相应工具。`,
        },
      ],
    };
  });

// 启动服务器
const transport = new StdioServerTransport();
await server.connect(transport);
console.log('MCP 服务器已启动，等待连接...');