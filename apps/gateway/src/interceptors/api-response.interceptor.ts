import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    data: T;
    metadata: {
        timestamp: string;
        status: number;
        path: string;
    };
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<Response<T>> {
        const request = context.switchToHttp().getRequest();
        const status = context.switchToHttp().getResponse().statusCode || HttpStatus.OK;

        return next.handle().pipe(
            map(data => ({
                data,
                metadata: {
                    timestamp: new Date().toISOString(),
                    status,
                    path: request.url,
                },
            })),
        );
    }
}
