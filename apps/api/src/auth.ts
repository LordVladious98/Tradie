import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth) throw new UnauthorizedException('Missing auth token');
    const token = auth.replace('Bearer ', '');
    try { req.user = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET }); return true; }
    catch { throw new UnauthorizedException('Invalid auth token'); }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const roles = Reflect.getMetadata(ROLES_KEY, ctx.getHandler()) as Role[] | undefined;
    if (!roles?.length) return true;
    const req = ctx.switchToHttp().getRequest();
    if (!roles.includes(req.user.role)) throw new ForbiddenException('Forbidden');
    return true;
  }
}
