import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const token = request.headers.authorization;

        if (!token) {

            return true;
            // We are returning true here
            // as authentication is not required
            //throw new UnauthorizedException('No token provided');
        }

        // Add your token validation logic here
        // For now, we'll just check if the token exists
        return true;
    }
}
