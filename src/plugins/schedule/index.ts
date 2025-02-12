import cron, { ScheduledTask, schedule, validate } from 'node-cron';
import { Trigger, RequestContext, TriggerProvider, DatapromptPlugin } from '../../core/interfaces.js';
import { DatapromptRoute } from '../../routing/server.js';
import { events } from '../../core/events.js';
import { DataSourceLogEvent, FlowLogEvent, LogContext } from '../../utils/logging.js'; 
import { randomUUID } from 'crypto';

type NodeCron = {
  schedule: typeof schedule,
  validate: typeof validate;
};

class DevScheduleTrigger implements Trigger {
  private cron: NodeCron;

  constructor(cron: NodeCron) {
    this.cron = cron;
  }

  create(
    route: DatapromptRoute,
    cronExpression: string,
  ): ScheduledTask {
    const name = `flow-${route.flowDef.name}`

    if (!this.cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }
    const task: ScheduledTask = this.cron.schedule(cronExpression, async () => {
      const executionId = randomUUID();
      const request: RequestContext = {
        method: '',
        url: '',
        headers: {},
        query: {},
        params: {}
      };

      events.emit('flow:event', {
        id: executionId,
        type: 'task',
        flowName: route.flowDef.name,
        inputSchema: route.flowDef.inputSchema,
        input: request,
        task: task,
        startTime: Date.now(),
      } satisfies FlowLogEvent & { 
        id: string, 
        type: string, 
        task: ScheduledTask, 
        startTime: number 
      });

      const start = Date.now();
      try {
        const result = await route.flow({ request });
        events.emit('datasource:event', {
          id: executionId,
          type: 'task',
          route: route.nextRoute,
          source: 'flow.output',
          variable: 'result',
          data: result,
          duration: Date.now() - start,
          task: task,
          taskName: name,
          startTime: start,
        } satisfies DataSourceLogEvent & { 
          id: string, 
          type: string, 
          taskName: string;
          task: ScheduledTask, 
          startTime: number,
          route: string,
        });

      } catch (error: any) {
        events.emit('error', {
          id: executionId,
          type: 'task',
          error: error,
          startTime: start
        });
      }

    }, {
      // Don't start automatically
      scheduled: false,
      name
    });

    return task;
  }
}

export function schedulerPlugin(): DatapromptPlugin {
  const name = 'schedule'
  return {
    name,
    createTrigger(): TriggerProvider {
      return {
        name,
        createTrigger(): Trigger {
          return new DevScheduleTrigger(cron);
        }
      }
    }
  }
}
