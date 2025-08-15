// Unit tests for summarization pipeline
import { describe, it, expect, beforeEach } from 'vitest';
import { SummarizationPipeline } from '../pipeline';
import { TextRankSummarizer } from '../textrank';
import { TfIdfKeywordExtractor } from '../tfidf';
import { SentenceScorer } from '../scorer';
import { SummarizationStage, SummarizationInput, SummarizationOutput, PipelineConfig } from '../types';

// Mock stage for testing
class MockStage implements SummarizationStage {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }

  async process(input: SummarizationInput): Promise<SummarizationOutput> {
    return {
      text: input.text + ` [processed by ${this.name}]`,
      metadata: {
        ...input.metadata,
        [`${this.name}_processed`]: true,
      },
    };
  }
}

describe('SummarizationPipeline', () => {
  let pipeline: SummarizationPipeline;
  let config: PipelineConfig;

  beforeEach(() => {
    config = {
      stages: ['stage1', 'stage2'],
    };
    pipeline = new SummarizationPipeline(config);
  });

  describe('basic functionality', () => {
    it('should create a pipeline instance', () => {
      expect(pipeline).toBeInstanceOf(SummarizationPipeline);
    });

    it('should register stages', () => {
      const stage1 = new MockStage('stage1');
      const stage2 = new MockStage('stage2');
      
      pipeline.registerStage(stage1);
      pipeline.registerStage(stage2);
      
      const availableStages = pipeline.getAvailableStages();
      expect(availableStages).toContain('stage1');
      expect(availableStages).toContain('stage2');
    });

    it('should register multiple stages at once', () => {
      const stages = [
        new MockStage('stage1'),
        new MockStage('stage2'),
        new MockStage('stage3'),
      ];
      
      pipeline.registerStages(stages);
      
      const availableStages = pipeline.getAvailableStages();
      expect(availableStages).toHaveLength(3);
    });
  });

  describe('pipeline execution', () => {
    it('should run pipeline with registered stages', async () => {
      const stage1 = new MockStage('stage1');
      const stage2 = new MockStage('stage2');
      
      pipeline.registerStages([stage1, stage2]);
      
      const input: SummarizationInput = {
        text: 'Original text',
      };

      const result = await pipeline.run(input);
      
      expect(result.text).toBe('Original text [processed by stage1] [processed by stage2]');
      expect(result.metadata?.stage1_processed).toBe(true);
      expect(result.metadata?.stage2_processed).toBe(true);
    });

    it('should throw error for unregistered stage', async () => {
      const input: SummarizationInput = { text: 'Test text' };
      
      await expect(pipeline.run(input)).rejects.toThrow("Stage 'stage1' not found in pipeline");
    });

    it('should handle empty pipeline', async () => {
      const emptyPipeline = new SummarizationPipeline({ stages: [] });
      const input: SummarizationInput = { text: 'Test text' };
      
      const result = await emptyPipeline.run(input);
      expect(result.text).toBe('Test text');
    });
  });

  describe('configuration management', () => {
    it('should get current configuration', () => {
      const currentConfig = pipeline.getConfig();
      expect(currentConfig.stages).toEqual(['stage1', 'stage2']);
    });

    it('should update configuration', () => {
      pipeline.updateConfig({ stages: ['newStage'] });
      const updatedConfig = pipeline.getConfig();
      expect(updatedConfig.stages).toEqual(['newStage']);
    });

    it('should validate configuration', () => {
      // Valid configuration
      pipeline.registerStages([new MockStage('stage1'), new MockStage('stage2')]);
      let validation = pipeline.validateConfig();
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Invalid configuration - unregistered stage
      pipeline.updateConfig({ stages: ['unregistered'] });
      validation = pipeline.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain("Stage 'unregistered' is not registered");

      // Invalid configuration - empty pipeline
      pipeline.updateConfig({ stages: [] });
      validation = pipeline.validateConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Pipeline must have at least one stage');
    });
  });

  describe('pipeline cloning', () => {
    it('should clone pipeline with same configuration', () => {
      const stage1 = new MockStage('stage1');
      pipeline.registerStage(stage1);
      
      const clonedPipeline = pipeline.clone();
      
      expect(clonedPipeline.getConfig()).toEqual(pipeline.getConfig());
      expect(clonedPipeline.getAvailableStages()).toEqual(pipeline.getAvailableStages());
    });

    it('should clone pipeline with new configuration', () => {
      const stage1 = new MockStage('stage1');
      pipeline.registerStage(stage1);
      
      const newConfig = { stages: ['stage1'] };
      const clonedPipeline = pipeline.clone(newConfig);
      
      expect(clonedPipeline.getConfig().stages).toEqual(['stage1']);
      expect(clonedPipeline.getAvailableStages()).toEqual(['stage1']);
    });
  });

  describe('real pipeline integration', () => {
    it('should work with actual summarization stages', async () => {
      const realConfig: PipelineConfig = {
        stages: ['tfidf', 'textrank', 'scorer'],
      };
      
      const realPipeline = new SummarizationPipeline(realConfig);
      realPipeline.registerStages([
        new TfIdfKeywordExtractor(),
        new TextRankSummarizer(),
        new SentenceScorer(),
      ]);

      const input: SummarizationInput = {
        text: 'Machine learning is a subset of artificial intelligence. ' +
              'It enables computers to learn from data without explicit programming. ' +
              'Deep learning is a specialized form of machine learning. ' +
              'Neural networks are the foundation of deep learning algorithms.',
        options: { targetLength: 2 }
      };

      const result = await realPipeline.run(input);
      
      expect(result.text).toBeTruthy();
      expect(result.keywords).toBeDefined();
      expect(result.sentences).toBeDefined();
      expect(result.metadata?.tfidf_processed).toBe(true);
      expect(result.metadata?.textrank_processed).toBe(true);
      expect(result.metadata?.scorer_processed).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle stage errors gracefully', async () => {
      class ErrorStage implements SummarizationStage {
        name = 'error-stage';
        
        async process(_input: SummarizationInput): Promise<SummarizationOutput> {
          throw new Error('Stage processing failed');
        }
      }

      const errorPipeline = new SummarizationPipeline({ stages: ['error-stage'] });
      errorPipeline.registerStage(new ErrorStage());

      const input: SummarizationInput = { text: 'Test text' };
      
      await expect(errorPipeline.run(input)).rejects.toThrow("Pipeline failed at stage 'error-stage'");
    });
  });

  describe('metadata propagation', () => {
    it('should propagate metadata through pipeline stages', async () => {
      const stage1 = new MockStage('stage1');
      const stage2 = new MockStage('stage2');
      
      pipeline.registerStages([stage1, stage2]);
      
      const input: SummarizationInput = {
        text: 'Test text',
        metadata: { initialData: 'test' },
      };

      const result = await pipeline.run(input);
      
      expect(result.metadata?.initialData).toBe('test');
      expect(result.metadata?.stage1_processed).toBe(true);
      expect(result.metadata?.stage2_processed).toBe(true);
      expect(result.metadata?.stage1_timestamp).toBeDefined();
      expect(result.metadata?.stage2_timestamp).toBeDefined();
    });
  });
});