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
        const { method, url, body, params, query } = request;
        const timestamp = Date.now();

        this.logger.log(
            `Incoming Request: ${method} ${url}
            Params: ${JSON.stringify(params)}
            Query: ${JSON.stringify(query)}
            Body: ${JSON.stringify(body)}`
        );

        return next.handle().pipe(
            tap({
                next: (response) => {
                    const responseTime = Date.now() - timestamp;
                    this.logger.log(
                        `Response for ${method} ${url}
                        Duration: ${responseTime}ms
                        Response: ${JSON.stringify(response)}`
                    );
                },
                error: (error) => {
                    const responseTime = Date.now() - timestamp;
                    this.logger.error(
                        `Error in ${method} ${url}
                        Duration: ${responseTime}ms
                        Error: ${JSON.stringify(error)}`
                    );
                },
            }),
        );
    }
}
