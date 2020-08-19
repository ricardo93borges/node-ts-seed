import { validateOrReject, ValidationError } from 'class-validator';
import { env } from './env';
import { HttpServer } from './http';
import { AppContainer } from './container';
import { Worker } from './worker';
import { logger } from './logger';
import { Bash } from './bash';
import { AMQPServer } from './amqp';
import { RabbitMQConfig } from './amqp/vhosts';

export class Application {
  protected readonly bashFlag = '--bash';
  protected httpServer?: HttpServer;
  protected worker?: Worker;
  protected bash?: Bash;
  protected amqpServer?: AMQPServer;

  constructor() {}

  protected async initBash(container: AppContainer): Promise<Bash> {
    const bash = new Bash(container);
    const bashCommandIndex = process.argv.indexOf(this.bashFlag);
    const signatures = process.argv.slice(bashCommandIndex + 1);

    if (signatures.length) {
      await bash.execute(signatures);
    }

    return bash;
  }

  async start(): Promise<void> {
    try {
      await validateOrReject(env);

      const rabbitMQConfig: RabbitMQConfig = {
        protocol: env.rabbitMQProtocol,
        host: env.rabbitMQHost,
        port: env.rabbitMQPort,
        username: env.rabbitMQUsername,
        password: env.rabbitMQPassword,
      };

      this.amqpServer = new AMQPServer(
        rabbitMQConfig,
        env.rabbitMQEnabled === 'true'
      );

      await this.amqpServer.start();

      const container = new AppContainer({
        homeVHost: this.amqpServer.vhosts.home,
        workVHost: this.amqpServer.vhosts.work,
      });

      this.amqpServer.startAllConsumers(container);

      if (process.argv.includes(this.bashFlag)) {
        this.bash = await this.initBash(container);
        process.exit(0);
      }

      this.worker = new Worker(container);
      this.worker.start();
      logger.info(`Worker started with ${this.worker.jobsCount} job(s)`);

      this.httpServer = new HttpServer(container, {
        port: env.httpPort,
        bodyLimit: env.httpBodyLimit,
      });
      this.httpServer.start();
      logger.info(`Http server started in port ${this.httpServer.port}`);
    } catch (err) {
      if (err.length && err[0] instanceof ValidationError) {
        this.throwEnvValidatorErrors(err);
      }
      throw err;
    }
  }

  private throwEnvValidatorErrors(err: ValidationError[]) {
    err.forEach((item: ValidationError) => {
      for (let key in item.constraints) {
        const message = item.constraints[key];
        throw new Error(message);
      }
    });
  }
}
