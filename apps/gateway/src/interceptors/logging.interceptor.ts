import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const { method, url, body } = request;
        const startTime = Date.now();

        return next.handle().pipe(
            tap({
                next: (data) => {
                    const endTime = Date.now();
                    this.logger.log(
                        `${method} ${url} ${JSON.stringify(body)} - ${endTime - startTime
                        }ms`
                    );
                },
                error: (error) => {
                    const endTime = Date.now();
                    this.logger.error(
                        `${method} ${url} ${JSON.stringify(body)} - ${endTime - startTime
                        }ms - Error: ${error.message}`
                    );
                },
            })
        );
    }
}
