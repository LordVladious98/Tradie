import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private prisma: PrismaService) {}

  async registerToken(userId: string, pushToken: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pushToken },
    });
  }

  async sendToUser(userId: string, title: string, body: string, data?: Record<string, any>) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.pushToken) return;

    await this.sendPush([{ to: user.pushToken, title, body, data }]);
  }

  async sendToBusinessUsers(businessId: string, title: string, body: string, data?: Record<string, any>) {
    const users = await this.prisma.user.findMany({
      where: { businessId, isActive: true, pushToken: { not: null } },
    });

    const messages = users
      .filter((u) => u.pushToken)
      .map((u) => ({ to: u.pushToken!, title, body, data }));

    if (messages.length > 0) await this.sendPush(messages);
  }

  private async sendPush(messages: PushMessage[]) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });
      if (!response.ok) {
        this.logger.warn(`Push send failed: ${response.status}`);
      }
    } catch (err) {
      this.logger.error('Push send error', err);
    }
  }
}
