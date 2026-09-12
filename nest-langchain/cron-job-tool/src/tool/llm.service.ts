/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ChatOpenAI } from '@langchain/openai';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LlmService {
  @Inject(ConfigService) private readonly configService: ConfigService;

  getModel() {
    return new ChatOpenAI({
      model: this.configService.get('MODEL_NAME'),
      apiKey: this.configService.get('OPENAI_API_KEY'),
      configuration: {
        baseURL: this.configService.get('OPENAI_BASE_URL'),
      },
    });
  }
}
