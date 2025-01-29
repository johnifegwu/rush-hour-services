export default () => ({
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://mongodb:27017/rushhour',
    },
    redis: {
        host: process.env.REDIS_HOST || 'redis',
        port: parseInt(process.env.REDIS_PORT!, 10) || 6379,
    },
    rabbitmq: {
        uri: process.env.RABBITMQ_URI || 'amqp://rabbitmq:5672',
        queues: {
            moveAnalysis: 'move-analysis',
        },
    },
});