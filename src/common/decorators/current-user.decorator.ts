import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../database/entities';

export const CurrentUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | Partial<User> => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;
    if (data && user) {
      return user[data] as Partial<User>;
    }
    return user;
  },
);
