import { randomUUID } from 'crypto';
import { events } from '../core/events.js';
import { RequestContext } from '../core/interfaces.js';
import { DatapromptRoute } from '../routing/server.js';

export interface LogContext<T extends string> {
	id: string;
	type: T;
	startTime: number;
}

export interface RequestLogContext extends LogContext<'request'> {
	route: DatapromptRoute;
	request: RequestContext;
}

export interface DataSourceLogEvent {
	route: string;
	source: string;
	variable: string;
	data: unknown;
	duration: number;
}

export interface FlowLogEvent {
	flowName: string;
	inputSchema: unknown;
	input: unknown;
}

export abstract class BaseLogger<T extends LogContext<any>> {
	protected context: T;

	constructor(context: T) {
		this.context = {
			...context,
			startTime: Date.now(),
		};
	}

	complete() {
		const duration = Date.now() - this.context.startTime;
		// TODO(davideast): fix hardcode requests
		events.emit('request:complete', { ...this.context, duration });
	}

	error(error: Error) {
		// TODO(davideast): fix hardcode requests
		events.emit('request:error', { ...this.context, error }); 
	}

	get id() {
		return this.context.id;
	}

	async dataSourceEvent(event: DataSourceLogEvent): Promise<void> {
		events.emit('datasource:event', { ...this.context, ...event });
	}

	async flowEvent(event: FlowLogEvent): Promise<void> {
		events.emit('flow:event', { ...this.context, ...event });
	}

	async promptCompilationEvent<Options>(
		input: Record<string, any>,
		options: Options,
	): Promise<void> {
		events.emit('prompt:compile', { ...this.context, input, options });
	}

	async actionEvent(
		actionName: string,
		config: any,
		result: any,
	): Promise<void> {
		events.emit('action:event', { ...this.context, actionName, config, result });
	}
}

export class RequestLogger extends BaseLogger<RequestLogContext> {
	constructor(params: {
		route: DatapromptRoute;
		request: RequestContext;
		requestId?: string;
	}) {
		const requestId = params.requestId || randomUUID();
		super({
			id: requestId,
			type: 'request',
			route: params.route,
			request: params.request,
			startTime: 0,
		});
	}
}

export interface LoggerStore {
	createRequestLogger(params: {
		route: DatapromptRoute;
		request: RequestContext;
		requestId?: string;
	}): RequestLogger;
	get(id: string): BaseLogger<any> | undefined;
}

let logManager: LoggerStore | undefined;

export function getLogManager(): LoggerStore {
	if (!logManager) {
		logManager = createLogStore();
	}
	return logManager;
}

export function createLogStore(): LoggerStore {
	const logs: Map<string, BaseLogger<RequestLogContext>> = new Map();
	return {
		get(id: string) {
			return logs.get(id);
		},
		createRequestLogger(params: {
			route: DatapromptRoute;
			request: RequestContext;
			requestId?: string;
		}): RequestLogger {
			const requestId = params.requestId || randomUUID();
			events.emit('request:created', { 
				id: requestId,
				type: 'request',
				route: params.route,
				request: params.request,
				startTime: Date.now()
			});
			const logger = new RequestLogger(params);
			logs.set(logger.id, logger);
			return logger;
		}
	}
}
