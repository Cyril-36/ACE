interface AxeResults {
  violations: unknown[];
  passes: unknown[];
  incomplete: unknown[];
  inapplicable: unknown[];
}

declare module 'jest-axe' {
  export function axe(container: HTMLElement): Promise<AxeResults>;
  export function toHaveNoViolations(): unknown;
}

declare global {
  namespace Vi {
    interface Assertion<T = unknown> {
      toHaveNoViolations(): T;
    }
  }
}