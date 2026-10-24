import { BadRequestError, ServiceUnavailableError, AppError } from "../errors";
import Bee from "bee-queue";
import DummyJob from "../jobs/DummyJob";
import WelcomeMail from "../jobs/WelcomeMail";
import BulkMail from "../jobs/BulkMail";
import redisConfig from "../../config/redis";
import queueConfig from "../../config/queue";
import monitoring from "../../lib/monitoring";
import logger from "../../lib/logger";

const jobs = [DummyJob, WelcomeMail, BulkMail];

export class Queue {
  constructor({ worker = false, QueueClass = Bee } = {}) {
    this.queues = {};
    this.worker = worker;
    this.QueueClass = QueueClass;
    this.processing = false;
  }

  getQueue(key) {
    const job = jobs.find((item) => item.key === key);
    if (!job) throw new BadRequestError(`Job desconhecido: ${key}`);
    if (!this.queues[key]) {
      const bee = new this.QueueClass(key, {
        redis: redisConfig,
        isWorker: this.worker,
        getEvents: false,
        sendEvents: false,
        storeJobs: false,
        activateDelayedJobs: this.worker,
        removeOnSuccess: true,
        removeOnFailure: false,
      });
      bee.on("error", (error) => monitoring.report(error, { component: this.worker ? "worker" : "api", queue: key }));
      bee.on("retrying", (failedJob) => logger.warn("job_retrying", { component: "worker", queue: key, jobId: String(failedJob.id) }));
      bee.on("failed:fatal", (failedJob, error) => monitoring.report(error, { component: "worker", queue: key, jobId: String(failedJob.id) }));
      bee.on("succeeded", (completedJob) => logger.info("job_completed", { component: "worker", queue: key, jobId: String(completedJob.id) }));
      this.queues[key] = { bee, handle: job.handle.bind(job) };
    }
    return this.queues[key];
  }

  async add(key, data) {
    try {
      const { bee } = this.getQueue(key);
      await bee.ready();
      return await bee
        .createJob(data)
        .retries(queueConfig.retries)
        .backoff("exponential", queueConfig.backoff)
        .save();
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new ServiceUnavailableError("Fila temporariamente indisponivel.", {
        code: "QUEUE_UNAVAILABLE",
        cause,
      });
    }
  }

  async processQueue() {
    try {
      if (!this.worker)
        throw new BadRequestError("Use uma fila worker para processar jobs.");
      if (this.processing) return;
      this.processing = true;
      for (const { key, concurrency = queueConfig.concurrency } of jobs) {
        const { bee, handle } = this.getQueue(key);
        await bee.ready();
        bee.process(concurrency, handle);
        bee.checkStalledJobs(5000, (error) => {
          if (error) monitoring.report(error, { component: "worker", queue: key });
        });
      }
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new ServiceUnavailableError("Fila temporariamente indisponivel.", {
        code: "QUEUE_UNAVAILABLE",
        cause,
      });
    }
  }

  async addMany(key, items) {
    try {
      this.getQueue(key);
      const results = [];
      for (let offset = 0; offset < items.length; offset += 25) {
        const batch = items.slice(offset, offset + 25);
        results.push(
          ...(await Promise.allSettled(
            batch.map((data) => this.add(key, data))
          ))
        );
      }
      return results;
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new ServiceUnavailableError("Fila temporariamente indisponivel.", {
        code: "QUEUE_UNAVAILABLE",
        cause,
      });
    }
  }

  async close() {
    try {
      const results = await Promise.allSettled(
        Object.values(this.queues).map(({ bee }) =>
          bee.close(queueConfig.shutdownTimeout)
        )
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw new ServiceUnavailableError("Fila temporariamente indisponivel.", {
        code: "QUEUE_UNAVAILABLE",
        cause,
      });
    }
  }
}

export default new Queue();
