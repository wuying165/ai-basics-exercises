import "dotenv/config"
import { Injectable } from '@nestjs/common';
import { OpenAIEmbeddings } from "@langchain/openai";
import { InjectEntityManager } from "@nestjs/typeorm";
import { EntityManager } from "typeorm";
import { Conversation } from "./entities/conversation.entity";
import { User } from "./entities/user.entity";

@Injectable()
export class ConversationsService {
  private embeddings: OpenAIEmbeddings | null = null

  constructor(@InjectEntityManager() private readonly em: EntityManager) {}

  //  用户 → 会话（一对多）
  async findConversationsByUserId (userId: number) {
    const user =  await this.em.findOne(User, {
      where: { id: userId },
      relations: { conversations: true },
      order: { conversations: { createdAt: "DESC" }}
    })
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  // 会话 → 消息（一对多）
  async findMessagesByConversationId (conversationId: number) {
    const conversation = await this.em.findOne(Conversation, {
      where: { id: conversationId },
      relations: { messages: true },
      order: { messages: { createdAt: "DESC" }}
    })
    
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    return {
      id: conversation.id,
      userId: conversation.userId,
      title: conversation.title,
      createdAt: conversation.createdAt,
      messages: conversation.messages.map((message) => ({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    };
  }

  async searchSimilarMessages(conversationId: number, searchText: string, limit: number = 5) {
    const conversation = await this.em.findOne(Conversation, { where: { id: conversationId } });
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const vector = await this.embedQuery(searchText);
    const rows = await this.em.query(`
      SELECT id, conversation_id, role, content, created_at, 1 - (embedding <=> $1::vector) AS similarity
      FROM messages
      WHERE conversation_id = $2 AND embedding IS NOT NULL
      ORDER BY embedding <=> $1::vector
      LIMIT $3
    `, [JSON.stringify(vector), conversationId, limit]);

    return rows.map((row) => ({ ...row, similarity: Number(row.similarity) }));
  }

  private getEmbeddings() {
    if (!this.embeddings) {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("语义检索需要配置 OPENAI_API_KEY");
      }

      this.embeddings = new OpenAIEmbeddings({
        model: process.env.OPENAI_MODEL,
        apiKey: process.env.OPENAI_API_KEY,
        configuration: { baseURL: process.env.OPENAI_BASE_URL }
      })
    }
    return this.embeddings;
  }
  private async embedQuery(query: string) {
    if (!this.embeddings) {
      throw new Error("Embeddings not initialized");
    }
    return await this.getEmbeddings().embedQuery(query);
  }
}
