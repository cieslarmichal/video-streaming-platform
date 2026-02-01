import { type LoggerService } from '@libs/logger';
import { type Channel, connect, type ChannelModel } from 'amqplib';

export interface CreateQueuePayload {
  readonly channel: Channel;
  readonly exchangeName: string;
  readonly queueName: string;
  readonly pattern: string;
  readonly dlqMessageTtl: number;
}

export class AmqpProvisioner {
  private readonly logger: LoggerService;

  public constructor(logger: LoggerService) {
    this.logger = logger;
  }

  public async createConnection(url: string): Promise<ChannelModel> {
    const connection = await connect(url);

    connection.addListener('close', () => {
      this.logger.debug({ message: 'AMQP connection closed' });
    });

    connection.addListener('error', (error) => {
      this.logger.error({ message: 'AMQP connection error', err: error });
    });

    connection.addListener('blocked', () => {
      this.logger.debug({ message: 'AMQP connection blocked' });
    });

    connection.addListener('unblocked', () => {
      this.logger.debug({ message: 'AMQP connection unblocked' });
    });

    return connection;
  }

  public async createChannel(connection: ChannelModel): Promise<Channel> {
    const channel = await connection.createChannel();

    channel.addListener('close', () => {
      this.logger.debug({ message: 'AMQP channel closed' });
    });

    channel.addListener('error', (error) => {
      this.logger.error({ message: 'AMQP channel error', err: error });
    });

    channel.addListener('drain', () => {
      this.logger.debug({ message: 'AMQP channel drained' });
    });

    await channel.prefetch(1, false);

    return channel;
  }

  public async createQueue(payload: CreateQueuePayload): Promise<void> {
    const { channel, exchangeName, queueName, pattern, dlqMessageTtl } = payload;

    const retryExchangeName = `${exchangeName}.retry`;

    await channel.assertExchange(exchangeName, 'topic');

    await channel.assertExchange(retryExchangeName, 'topic');

    await channel.assertQueue(queueName, {
      deadLetterExchange: retryExchangeName,
    });

    await channel.assertQueue(`${queueName}.retry`, {
      deadLetterExchange: exchangeName,
      messageTtl: dlqMessageTtl,
    });

    await channel.bindQueue(queueName, exchangeName, pattern);

    await channel.bindQueue(`${queueName}.retry`, retryExchangeName, pattern);
  }
}
