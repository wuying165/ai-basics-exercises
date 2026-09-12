import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookModule } from './book/book.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './book/entities/book.entity';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    BookModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, 'public'),
      serveRoot: '/books',
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: isProduction ? 'mysql-prod' : 'localhost',
      port: 3306,
      username: 'root',
      password: 'admin',
      database: 'book',
      synchronize: true,
      connectorPackage: 'mysql2',
      logging: true,
      entities: [Book],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
