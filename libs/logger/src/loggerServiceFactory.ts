import { pino, stdSerializers } from 'pino';

import { LoggerService } from './loggerService.ts';
import { type LogLevel } from './logLevel.ts';

interface LoggerServiceConfig {
  readonly appName: string;
  readonly logLevel: LogLevel;
}

export class LoggerServiceFactory {
  public static create(config: LoggerServiceConfig): LoggerService {
    const logger = pino({
      name: config.appName,
      level: config.logLevel,
      base: null,
      serializers: {
        err: stdSerializers.err,
      },
    });

    return new LoggerService(logger);
  }
}
