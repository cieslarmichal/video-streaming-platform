import { type LoggerService } from '@libs/logger';
import { Redis } from 'ioredis';

export interface RedisClientConfig {
  readonly host: string;
  readonly port: number;
}

export type RedisClient = Redis;

export class RedisClientFactory {
  private readonly logger: LoggerService;

  public constructor(logger: LoggerService) {
    this.logger = logger;
  }

  public create(config: RedisClientConfig): RedisClient {
    const client = new Redis({
      host: config.host,
      port: config.port,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
    });

    client.on('connect', () => {
      this.logger.debug({ message: 'Redis client connected' });
    });

    client.on('ready', () => {
      this.logger.debug({ message: 'Redis client ready' });
    });

    client.on('error', (error) => {
      this.logger.error({
        message: 'Redis error',
        err: error,
      });
    });

    client.on('close', () => {
      this.logger.debug({ message: 'Redis client connection closed' });
    });

    client.on('reconnecting', () => {
      this.logger.debug({ message: 'Redis client reconnecting' });
    });

    client.on('end', () => {
      this.logger.debug({ message: 'Redis client connection ended' });
    });

    return client;
  }
}
