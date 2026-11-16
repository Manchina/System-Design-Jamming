import crypto from "node:crypto";
import { logger } from "../logger/index.js";

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

export interface Span {
  context: SpanContext;
  name: string;
  startTime: bigint; // hrtime bigint
  attributes: Record<string, unknown>;
  end(extraAttributes?: Record<string, unknown>): number; // returns duration ms
}

export class TelemetryTracer {
  private serviceName: string;

  constructor(serviceName = "system-design-service") {
    this.serviceName = serviceName;
  }

  /**
   * Generates a 16-byte (32 hex characters) trace ID.
   */
  public generateTraceId(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Generates an 8-byte (16 hex characters) span ID.
   */
  public generateSpanId(): string {
    return crypto.randomBytes(8).toString("hex");
  }

  /**
   * Parses W3C traceparent header: 00-{traceId}-{spanId}-{flags}
   */
  public parseTraceparent(header?: string | null): SpanContext {
    if (!header) {
      return {
        traceId: this.generateTraceId(),
        spanId: this.generateSpanId(),
        sampled: true,
      };
    }

    const parts = header.trim().split("-");
    if (parts.length === 4 && parts[0] === "00" && parts[1].length === 32 && parts[2].length === 16) {
      return {
        traceId: parts[1],
        parentSpanId: parts[2],
        spanId: this.generateSpanId(),
        sampled: parts[3] === "01",
      };
    }

    return {
      traceId: this.generateTraceId(),
      spanId: this.generateSpanId(),
      sampled: true,
    };
  }

  /**
   * Formats context into a W3C traceparent header string.
   */
  public formatTraceparent(context: SpanContext): string {
    const flags = context.sampled ? "01" : "00";
    return `00-${context.traceId}-${context.spanId}-${flags}`;
  }

  /**
   * Starts an active span and returns handle.
   */
  public startSpan(name: string, parentContext?: SpanContext, attributes: Record<string, unknown> = {}): Span {
    const context: SpanContext = parentContext
      ? {
          traceId: parentContext.traceId,
          parentSpanId: parentContext.spanId,
          spanId: this.generateSpanId(),
          sampled: parentContext.sampled,
        }
      : {
          traceId: this.generateTraceId(),
          spanId: this.generateSpanId(),
          sampled: true,
        };

    const startTime = process.hrtime.bigint();
    const spanAttributes = {
      "service.name": this.serviceName,
      ...attributes,
    };

    return {
      context,
      name,
      startTime,
      attributes: spanAttributes,
      end: (extraAttributes?: Record<string, unknown>) => {
        const endTime = process.hrtime.bigint();
        const durationNs = Number(endTime - startTime);
        const durationMs = durationNs / 1_000_000;

        if (extraAttributes) {
          Object.assign(spanAttributes, extraAttributes);
        }

        logger.debug(
          {
            traceId: context.traceId,
            spanId: context.spanId,
            parentSpanId: context.parentSpanId,
            spanName: name,
            durationMs: Number(durationMs.toFixed(3)),
            ...spanAttributes,
          },
          `[Trace] span '${name}' completed in ${durationMs.toFixed(3)}ms`
        );

        return durationMs;
      },
    };
  }

  /**
   * Wraps an async execution block in a measured span.
   */
  public async withSpan<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    parentContext?: SpanContext,
    attributes: Record<string, unknown> = {}
  ): Promise<T> {
    const span = this.startSpan(name, parentContext, attributes);
    try {
      const result = await fn(span);
      span.end({ "span.status": "OK" });
      return result;
    } catch (error) {
      span.end({
        "span.status": "ERROR",
        "error.message": error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

export const tracer = new TelemetryTracer("fastify-distributed-app");
