// Summarization pipeline orchestrator
import { 
  SummarizationStage, 
  SummarizationInput, 
  SummarizationOutput, 
  PipelineConfig 
} from './types';

export class SummarizationPipeline {
  private stages: Map<string, SummarizationStage> = new Map();
  private config: PipelineConfig;

  constructor(config: PipelineConfig) {
    this.config = config;
  }

  // Register a stage with the pipeline
  registerStage(stage: SummarizationStage): void {
    this.stages.set(stage.name, stage);
  }

  // Register multiple stages
  registerStages(stages: SummarizationStage[]): void {
    stages.forEach(stage => this.registerStage(stage));
  }

  // Run the pipeline with the configured stages
  async run(input: SummarizationInput): Promise<SummarizationOutput> {
    let currentOutput: SummarizationOutput = {
      text: input.text,
      metadata: { ...input.metadata },
    };

    // Process through each configured stage
    for (const stageName of this.config.stages) {
      const stage = this.stages.get(stageName);
      if (!stage) {
        throw new Error(`Stage '${stageName}' not found in pipeline`);
      }

      try {
        // Create input for the next stage
        const stageInput: SummarizationInput = {
          text: currentOutput.text,
          options: input.options,
          metadata: {
            ...currentOutput.metadata,
            previousStage: stageName,
          },
        };

        // Process through the stage
        currentOutput = await stage.process(stageInput);
        
        // Add stage metadata
        currentOutput.metadata = {
          ...currentOutput.metadata,
          [`${stageName}_processed`]: true,
          [`${stageName}_timestamp`]: Date.now(),
        };

      } catch (error) {
        throw new Error(`Pipeline failed at stage '${stageName}': ${error}`);
      }
    }

    return currentOutput;
  }

  // Get available stages
  getAvailableStages(): string[] {
    return Array.from(this.stages.keys());
  }

  // Get current configuration
  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  // Update pipeline configuration
  updateConfig(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // Validate pipeline configuration
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if all configured stages are registered
    for (const stageName of this.config.stages) {
      if (!this.stages.has(stageName)) {
        errors.push(`Stage '${stageName}' is not registered`);
      }
    }

    // Check for empty pipeline
    if (this.config.stages.length === 0) {
      errors.push('Pipeline must have at least one stage');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Create a copy of the pipeline with different config
  clone(newConfig?: Partial<PipelineConfig>): SummarizationPipeline {
    const config = newConfig ? { ...this.config, ...newConfig } : this.config;
    const newPipeline = new SummarizationPipeline(config);
    
    // Copy all registered stages
    this.stages.forEach(stage => {
      newPipeline.registerStage(stage);
    });

    return newPipeline;
  }
}