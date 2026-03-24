import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, User } from '../database/entities';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateNotificationDto } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async create(dto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepo.create(dto);
    return this.notificationRepo.save(notification);
  }

  async findAllByUser(user: User): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId: user.id },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(id: string, user: User): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== user.id && user.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Access denied');
    }
    return notification;
  }

  async markAsRead(id: string, user: User): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== user.id) {
      throw new ForbiddenException('Access denied');
    }
    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(user: User): Promise<void> {
    await this.notificationRepo.update(
      { userId: user.id, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }
}
