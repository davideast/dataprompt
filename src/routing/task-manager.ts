import { ScheduledTask } from 'node-cron';
import { events } from '../core/events.js';

export interface TaskManager {
  single(nextRoute: string): ScheduledTask;
  all(): Map<string, ScheduledTask>;
  cleanup(): void;
  startAll(): void;
  stopAll(): void;
}

export function createTaskManager(
  scheduledTasks: Map<string, ScheduledTask>
): TaskManager {
  return {
    all() {
      return scheduledTasks;
    },
    single(nextRoute: string) {
      const task = scheduledTasks.get(nextRoute);
      if (!task) {
        throw new Error(`No task found for route: ${nextRoute}`);
      }
      return task;
    },
    startAll() {
      for (const [route, task] of scheduledTasks.entries()) {
        task.start();
        events.emit('task:start', {
          route,
          task,
          timestamp: performance.now()
        });
      }
    },
    stopAll() {
      for (const [route, task] of scheduledTasks.entries()) {
        task.stop();
        events.emit('task:stop', {
          route,
          task,
          timestamp: performance.now()
        });
      }
    },
    cleanup() {
      this.stopAll();
      scheduledTasks.clear();
      events.emit('task:cleanup', {
        timestamp: performance.now()
      })
    },
  };
}
