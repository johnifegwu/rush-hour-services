import {
    Injectable,
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { RedisService } from '../../../../shared/src/services/redis.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
    private readonly WINDOW_SIZE_IN_SECONDS = 60;
    private readonly MAX_REQUESTS_PER_WINDOW = 100;

    constructor(private readonly redisService: RedisService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const ip = request.ip;
        const key = `ratelimit:${ip}`;
        const currentTime = Math.floor(Date.now() / 1000);
        const windowStart = currentTime - this.WINDOW_SIZE_IN_SECONDS;

        const client = this.redisService.getClient();

        // Execute commands in a transaction
        const multi = client.multi();

        await multi
            .zRemRangeByScore(key, '-inf', windowStart)
            .zAdd(key, { score: currentTime, value: `${currentTime}-${Math.random()}` })
            .zCard(key)
            .expire(key, this.WINDOW_SIZE_IN_SECONDS)
            .exec();

        // Get current request count
        const requestCount = await client.zCard(key);

        if (requestCount > this.MAX_REQUESTS_PER_WINDOW) {
            throw new HttpException(
                {
                    status: HttpStatus.TOO_MANY_REQUESTS,
                    error: 'Too many requests',
                    message: 'Please try again later',
                },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        return true;
    }
}
