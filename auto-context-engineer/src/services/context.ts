// Context capture and management service
import { Context, ContextSource, ContextSnapshot, TokenUsage } from "../types";

export interface ContextService {
  // Context capture
  startMonitoring(_source: ContextSource): void;
  stopMonitoring(_source: ContextSource): void;
  getCurrentContext(_source: ContextSource): ContextSnapshot;

  // Context processing
  processContext(_data: unknown, _source: ContextSource): Promise<Context>;

  // Event handlers
  onContextChange(_callback: (context: unknown) => void): void;
  onTokenLimitApproach(_callback: (usage: TokenUsage) => void): void;
}

// Placeholder implementation - will be implemented in later tasks
export class ContextCaptureService implements ContextService {
  startMonitoring(_source: ContextSource): void {
    throw new Error("Not implemented");
  }

  stopMonitoring(_source: ContextSource): void {
    throw new Error("Not implemented");
  }

  getCurrentContext(_source: ContextSource): ContextSnapshot {
    throw new Error("Not implemented");
  }

  async processContext(
    _data: unknown,
    _source: ContextSource,
  ): Promise<Context> {
    throw new Error("Not implemented");
  }

  onContextChange(_callback: (context: unknown) => void): void {
    throw new Error("Not implemented");
  }

  onTokenLimitApproach(_callback: (usage: TokenUsage) => void): void {
    throw new Error("Not implemented");
  }
}
