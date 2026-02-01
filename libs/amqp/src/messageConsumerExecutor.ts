import { type LoggerService } from '@libs/logger';
import { type Channel, type Message } from 'amqplib';

import { type MessageConsumer } from './messageConsumer.js';

export class MessageConsumerExecutor {
  private readonly messageConsumer: MessageConsumer;
  private readonly channel: Channel;
  private readonly logger: LoggerService;
  private readonly queueName: string;
  private readonly redeliveryDropThreshold: number;

  public constructor(
    messageConsumer: MessageConsumer,
    channel: Channel,
    logger: LoggerService,
    queueName: string,
    redeliveryDropThreshold: number,
  ) {
    this.messageConsumer = messageConsumer;
    this.channel = channel;
    this.logger = logger;
    this.queueName = queueName;
    this.redeliveryDropThreshold = redeliveryDropThreshold;
  }

  public async startConsuming(): Promise<void> {
    const consumerWrapper = async (message: Message | null): Promise<void> => {
      if (message === null) {
        return;
      }

      const parsedMessage = JSON.parse(message.content.toString());

      const { routingKey } = message.fields;

      try {
        this.logger.debug({ message: 'Consuming message...', routingKey, content: parsedMessage });

        await this.messageConsumer.consume({
          message: parsedMessage,
          routingKey,
        });

        this.channel.ack(message);

        this.logger.debug({ message: 'Message consumed.', routingKey, content: parsedMessage });
      } catch (error) {
        const redeliveryDropThreshold = this.redeliveryDropThreshold;

        const dropMessage = message.properties.headers?.['x-death']?.find(
          ({ count, reason }) => reason === 'rejected' && count > redeliveryDropThreshold,
        );

        if (dropMessage) {
          this.logger.error({
            message: 'Message dropped due to redelivery count threshold exceeded.',
            routingKey,
            content: parsedMessage,
            err: error,
          });

          this.channel.ack(message);

          return;
        } else {
          this.logger.error({
            message: 'Error while consuming message.',
            err: error,
            routingKey,
            content: parsedMessage,
            redeliveryCount:
              message.properties.headers?.['x-death']?.find(({ reason }) => reason === 'rejected')?.count ?? 0,
          });

          this.channel.reject(message, false);
        }
      }
    };

    await this.channel.consume(this.queueName, consumerWrapper);

    this.logger.info({ message: 'Message consumer started.', queueName: this.queueName });
  }
}
