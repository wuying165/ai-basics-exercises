import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { SemanticSearchDto } from './dto/semantic-search.dto';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get('users/:userId')
  findByUserId(@Param('userId') userId: number) {
    return this.conversationsService.findConversationsByUserId(userId);
  }

  @Get(':id/messages')
  findMessages(@Param('id') id: number) {
    return this.conversationsService.findMessagesByConversationId(id);
  }

  @Post(':id/search')
  seach(@Param('id') id: number, @Body() dto: SemanticSearchDto, @Query('limit') queryLimit?: number){
    const limit = dto.limit ?? queryLimit ?? 10;
    return this.conversationsService.searchSimilarMessages(id, dto.query, limit)
  }
}
