// API service for cloud provider integration
import { CloudProvider, Summary } from "../types";

export interface APIService {
  // Cloud API calls
  callOpenAI(_content: string, _apiKey: string): Promise<Summary>;
  callClaude(_content: string, _apiKey: string): Promise<Summary>;
  callGemini(_content: string, _apiKey: string): Promise<Summary>;

  // Cost estimation
  estimateCost(_content: string, _provider: CloudProvider): Promise<number>;

  // API key validation
  validateApiKey(_provider: CloudProvider, _apiKey: string): Promise<boolean>;
}

// Placeholder implementation - will be implemented in later tasks
export class CloudAPIService implements APIService {
  async callOpenAI(_content: string, _apiKey: string): Promise<Summary> {
    throw new Error("Not implemented");
  }

  async callClaude(_content: string, _apiKey: string): Promise<Summary> {
    throw new Error("Not implemented");
  }

  async callGemini(_content: string, _apiKey: string): Promise<Summary> {
    throw new Error("Not implemented");
  }

  async estimateCost(
    _content: string,
    _provider: CloudProvider,
  ): Promise<number> {
    throw new Error("Not implemented");
  }

  async validateApiKey(
    _provider: CloudProvider,
    _apiKey: string,
  ): Promise<boolean> {
    throw new Error("Not implemented");
  }
}
