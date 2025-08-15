// Validation utilities
import { Context, Summary, UserPreferences } from "../types";

export class ValidationUtils {
  static validateContext(context: Partial<Context>): boolean {
    return !!(
      context.id &&
      context.source &&
      context.timestamp &&
      context.content &&
      context.metadata
    );
  }

  static validateSummary(summary: Partial<Summary>): boolean {
    return !!(
      summary.id &&
      summary.content &&
      summary.algorithm &&
      summary.timestamp &&
      typeof summary.originalLength === "number" &&
      typeof summary.summaryLength === "number"
    );
  }

  static validateUserPreferences(
    preferences: Partial<UserPreferences>,
  ): boolean {
    return !!(
      preferences.privacy &&
      preferences.summarization &&
      preferences.cloud &&
      preferences.ui
    );
  }

  static validateApiKey(apiKey: string): boolean {
    return apiKey.length > 0 && apiKey.trim() !== "";
  }

  static sanitizeInput(input: string): string {
    return input.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "",
    );
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Export individual functions for convenience
export const validateEmail = ValidationUtils.validateEmail.bind(ValidationUtils);
export const validateUrl = ValidationUtils.validateUrl.bind(ValidationUtils);
export const sanitizeInput = ValidationUtils.sanitizeInput.bind(ValidationUtils);
export const validateContext = ValidationUtils.validateContext.bind(ValidationUtils);
export const validateSummary = ValidationUtils.validateSummary.bind(ValidationUtils);
