import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { User } from '../../database/entities';
import { Client } from '../../database/entities/client.entity';
import { Matter } from '../../database/entities/matter.entity';

@Injectable()
export class ClientAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Client)
    private clientRepo: Repository<Client>,
    @InjectRepository(Matter)
    private matterRepo: Repository<Matter>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as User;

    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role !== UserRole.CLIENT) {
      return true; // Let other guards handle non-clients
    }

    // Client can only access their own data
    const matterId = request.params.matterId || request.params.id;
    const clientId = request.params.clientId;

    if (clientId) {
      const client = await this.clientRepo.findOne({
        where: { id: clientId, userId: user.id },
      });
      if (!client) {
        throw new ForbiddenException('Access denied to this client');
      }
    }

    if (matterId) {
      const matter = await this.matterRepo.findOne({
        where: { id: matterId },
        relations: ['client'],
      });
      if (!matter || matter.client.userId !== user.id) {
        throw new ForbiddenException('Access denied to this matter');
      }
    }

    return true;
  }
}
