import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import rateLimit from 'express-rate-limit';
import { AppController } from './controllers';
import { AppService } from './service';
import { PrismaService } from './prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { ErrorFilter } from './error.filter';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AppController],
  providers: [AppService, PrismaService, { provide: APP_FILTER, useClass: ErrorFilter }]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(rateLimit({ windowMs: 60_000, max: 20 })).forRoutes('/auth/login', '/auth/register-owner', '/auth/refresh');
  }
}
