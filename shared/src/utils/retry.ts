interface RetryOptions {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
}

export async function exponentialBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions
): Promise<T> {
    let attempts = 0;

    while (true) {
        try {
            return await fn();
        } catch (error) {
            attempts++;

            if (attempts >= options.maxRetries) {
                throw error;
            }

            const delay = Math.min(
                options.initialDelay * Math.pow(2, attempts),
                options.maxDelay
            );

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}
