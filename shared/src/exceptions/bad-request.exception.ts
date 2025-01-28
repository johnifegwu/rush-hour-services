export class BadRequestException extends Error {
    private innerException?: Error;
    constructor(message: string, innerException?: Error) {
        super(message);
        this.name = 'BadRequestException';

        // Maintains proper stack trace for where error was thrown
        Error.captureStackTrace(this, this.constructor);

        // Set the prototype explicitly
        Object.setPrototypeOf(this, BadRequestException.prototype);

        // Store inner exception if provided
        if (innerException) {
            this['innerException'] = innerException;
        }
    }
}
