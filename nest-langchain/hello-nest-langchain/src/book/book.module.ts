import { Module } from '@nestjs/common';
import { BookService } from './book.service';
import { BookController } from './book.controller';
@Module({
  controllers: [BookController],
  providers: [
    BookService,
    {
      provide: 'BOOK_REPOSITORY',
      useFactory() {
        const books = [
          { id: 1, title: 'Book 1' },
          { id: 2, title: 'Book 2' },
          { id: 3, title: 'Book 3' },
        ];
        return {
          findAll: () => [...books],
        };
      },
    },
  ],
})
export class BookModule {}
