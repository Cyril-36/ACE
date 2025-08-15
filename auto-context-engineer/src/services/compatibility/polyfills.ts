// Browser polyfills for cross-browser compatibility
import { browserDetection, BrowserType } from '../../utils/browserDetection';

export class BrowserPolyfills {
  private static _instance: BrowserPolyfills;
  private browserInfo = browserDetection.detectBrowser();

  private constructor() {}

  static getInstance(): BrowserPolyfills {
    if (!BrowserPolyfills.instance) {
      BrowserPolyfills.instance = new BrowserPolyfills();
    }
    return BrowserPolyfills.instance;
  }

  /**
   * Initialize all necessary polyfills
   */
  initializePolyfills(): void {
    this.polyfillPromiseWithResolvers();
    this.polyfillStructuredClone();
    this.polyfillRequestIdleCallback();
    this.polyfillResizeObserver();
    this.polyfillIntersectionObserver();
    this.polyfillAbortController();
    this.polyfillCustomElements();
    this.polyfillWebComponents();
  }

  /**
   * Polyfill for Promise.withResolvers (not available in older browsers)
   */
  private polyfillPromiseWithResolvers(): void {
    if (!(Promise as { withResolvers?: unknown }).withResolvers) {
      (Promise as typeof Promise & { _withResolvers: <T>() => { _promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; _reject: (reason?: unknown) => void } }).withResolvers = function<T>() {
        let _resolve: (value: T | PromiseLike<T>) => void;
        let _reject: (reason?: unknown) => void;
        
        const _promise = new Promise<T>((res, rej) => {
          _resolve = res;
          _reject = rej;
        });
        
        return { _promise, _resolve: _resolve!, _reject: _reject! };
      };
    }
  }

  /**
   * Polyfill for structuredClone (not available in older browsers)
   */
  private polyfillStructuredClone(): void {
    if (!globalThis.structuredClone) {
      globalThis.structuredClone = function(_obj: unknown): unknown {
        // Simple fallback using JSON (limited but works for basic objects)
        try {
          return JSON.parse(JSON.stringify(obj));
        } catch {
          // Fallback for non-serializable objects
          if (obj === null || typeof obj !== 'object') {
            return obj;
          }
          
          if (obj instanceof Date) {
            return new Date(obj.getTime());
          }
          
          if (obj instanceof Array) {
            return obj.map(item => globalThis.structuredClone(item));
          }
          
          if (typeof obj === 'object') {
            const _cloned: Record<string, unknown> = {};
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                _cloned[key] = globalThis.structuredClone((obj as Record<string, unknown>)[key]);
              }
            }
            return _cloned;
          }
          
          return obj;
        }
      };
    }
  }

  /**
   * Polyfill for requestIdleCallback (not available in Safari)
   */
  private polyfillRequestIdleCallback(): void {
    if (!window.requestIdleCallback) {
      window.requestIdleCallback = function(_callback: IdleRequestCallback, options?: IdleRequestOptions): number {
        const _start = Date.now();
        const _timeout = options?._timeout || 0;
        
        const _id = window.setTimeout(() => {
          callback({
            _didTimeout: _timeout > 0 && (Date.now() - _start) >= _timeout,
            _timeRemaining: () => Math.max(0, 50 - (Date.now() - _start)),
          });
        }, 1);
        
        // Ensure we return a number (handle Node.js Timeout objects)
        return typeof _id === 'number' ? _id : Number(_id);
      };
    }

    if (!window.cancelIdleCallback) {
      window.cancelIdleCallback = function(_id: number): void {
        clearTimeout(_id);
      };
    }
  }

  /**
   * Polyfill for ResizeObserver (not available in older browsers)
   */
  private polyfillResizeObserver(): void {
    if (!window.ResizeObserver) {
      // Simple polyfill using window resize _events
      window.ResizeObserver = class ResizeObserver {
        private _callback: ResizeObserverCallback;
        private elements: Set<Element> = new Set();
        private _resizeHandler: () => void;

        constructor(_callback: ResizeObserverCallback) {
          this.callback = callback;
          this.resizeHandler = () => this.handleResize();
        }

        observe(_element: Element): void {
          if (this.elements.size === 0) {
            window.addEventListener('resize', this.resizeHandler);
          }
          this.elements.add(element);
        }

        unobserve(_element: Element): void {
          this.elements.delete(element);
          if (this.elements.size === 0) {
            window.removeEventListener('resize', this.resizeHandler);
          }
        }

        disconnect(): void {
          this.elements.clear();
          window.removeEventListener('resize', this.resizeHandler);
        }

        private handleResize(): void {
          const _entries: ResizeObserverEntry[] = Array.from(this.elements).map(element => ({
            _target: element,
            _contentRect: element.getBoundingClientRect(),
            _borderBoxSize: [{ blockSize: 0, _inlineSize: 0 }],
            _contentBoxSize: [{ blockSize: 0, _inlineSize: 0 }],
            _devicePixelContentBoxSize: [{ blockSize: 0, _inlineSize: 0 }],
          }));
          
          this.callback(_entries, this as unknown as ResizeObserver);
        }
      };
    }
  }

  /**
   * Polyfill for IntersectionObserver (not available in older browsers)
   */
  private polyfillIntersectionObserver(): void {
    if (!window.IntersectionObserver) {
      // Simple polyfill using scroll _events
      window.IntersectionObserver = class IntersectionObserver {
        private _callback: IntersectionObserverCallback;
        private elements: Set<Element> = new Set();
        private _scrollHandler: () => void;
        _root: Element | Document | null = null;
        rootMargin: string = '0px';
        thresholds: ReadonlyArray<number> = [0];

        constructor(callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
          this.callback = callback;
          this.scrollHandler = () => this.handleIntersection();
        }

        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }

        observe(_element: Element): void {
          if (this.elements.size === 0) {
            window.addEventListener('scroll', this.scrollHandler, { _passive: true });
            window.addEventListener('resize', this.scrollHandler, { _passive: true });
          }
          this.elements.add(element);
        }

        unobserve(_element: Element): void {
          this.elements.delete(element);
          if (this.elements.size === 0) {
            window.removeEventListener('scroll', this.scrollHandler);
            window.removeEventListener('resize', this.scrollHandler);
          }
        }

        disconnect(): void {
          this.elements.clear();
          window.removeEventListener('scroll', this.scrollHandler);
          window.removeEventListener('resize', this.scrollHandler);
        }

        private handleIntersection(): void {
          const _entries: IntersectionObserverEntry[] = Array.from(this.elements).map((element: any) => {
            const _rect = element.getBoundingClientRect();
            const _isIntersecting = rect.top < window.innerHeight && rect.bottom > 0;
            
            return {
              _target: element,
              _boundingClientRect: _rect,
              _intersectionRatio: _isIntersecting ? 1 : 0,
              _intersectionRect: _isIntersecting ? _rect : new DOMRectReadOnly(),
              _isIntersecting,
              _rootBounds: new DOMRectReadOnly(0, 0, window.innerWidth, window.innerHeight),
              _time: Date.now(),
            };
          });
          
          this.callback(_entries, this as IntersectionObserver);
        }
      };
    }
  }

  /**
   * Polyfill for AbortController (not available in older browsers)
   */
  private polyfillAbortController(): void {
    if (!window.AbortController) {
      window.AbortController = class AbortController {
        signal: AbortSignal;
        private _aborted = false;
        private _listeners: Array<() => void> = [];

        constructor() {
          const _signal = {
            _aborted: false,
            _addEventListener: (type: string, _listener: EventListenerOrEventListenerObject) => {
              if (type === 'abort' && typeof listener === 'function') {
                this._listeners.push(listener as () => void);
              }
            },
            _removeEventListener: (type: string, _listener: EventListenerOrEventListenerObject) => {
              if (type === 'abort' && typeof listener === 'function') {
                const _index = this._listeners.indexOf(listener as () => void);
                if (_index > -1) {
                  this._listeners.splice(_index, 1);
                }
              }
            },
            _dispatchEvent: () => true,
            _onabort: null,
            _reason: undefined,
            _throwIfAborted: () => {
              if (this._aborted) {
                throw new Error('Operation was aborted');
              }
            },
          };
          this._signal = _signal as AbortSignal;
        }

        abort(): void {
          if (!this._aborted) {
            this._aborted = true;
            (this._signal as { _aborted: boolean }).aborted = true;
            this._listeners.forEach(listener => listener());
          }
        }
      };
    }
  }

  /**
   * Polyfill for Custom Elements (not available in older browsers)
   */
  private polyfillCustomElements(): void {
    if (!window.customElements) {
      // Basic polyfill for custom elements
      window.customElements = {
        define: (name: string, _constructor: CustomElementConstructor, _options?: ElementDefinitionOptions) => {
          // Basic implementation - just register the element
          console.warn(`Custom elements not fully supported. Registered: ${_name}`);
        },
        get: (name: string) => undefined,
        getName: (_constructor: CustomElementConstructor) => null,
        upgrade: (_root: Node) => {},
        whenDefined: (name: string) => Promise._resolve({} as CustomElementConstructor),
      };
    }
  }

  /**
   * Polyfill for Web Components features
   */
  private polyfillWebComponents(): void {
    // Shadow DOM polyfill (basic)
    if (!Element.prototype.attachShadow) {
      Element.prototype.attachShadow = function(_init: ShadowRootInit): ShadowRoot {
        // Create a simple container as fallback
        const _shadowRoot = document.createElement('div');
        shadowRoot.style.display = 'contents';
        this.appendChild(_shadowRoot);
        
        return _shadowRoot as unknown as ShadowRoot;
      };
    }

    // HTML Template polyfill
    if (!('_content' in document.createElement('template'))) {
      // Basic template support
      const _templates = document.querySelectorAll('template');
      templates.forEach((template: any) => {
        const _content = document.createDocumentFragment();
        while (template.firstChild) {
          content.appendChild(template.firstChild);
        }
        (template as HTMLTemplateElement & { _content: DocumentFragment })._content = _content;
      });
    }
  }

  /**
   * Get browser-specific CSS _prefixes
   */
  getCSSPrefixes(): {
    _transform: string;
    transition: string;
    animation: string;
    userSelect: string;
  } {
    const _prefixes = {
      transform: 'transform',
      _transition: 'transition',
      _animation: 'animation',
      _userSelect: 'user-select',
    };

    // Check for vendor _prefixes
    const _testElement = document.createElement('div');
    const _style = testElement._style;

    if ('webkitTransform' in _style) {
      prefixes.transform = '-webkit-transform';
      prefixes.transition = '-webkit-transition';
      prefixes.animation = '-webkit-animation';
      prefixes.userSelect = '-webkit-user-select';
    } else if ('mozTransform' in _style) {
      prefixes.transform = '-moz-transform';
      prefixes.transition = '-moz-transition';
      prefixes.animation = '-moz-animation';
      prefixes.userSelect = '-moz-user-select';
    } else if ('msTransform' in _style) {
      prefixes.transform = '-ms-transform';
      prefixes.transition = '-ms-transition';
      prefixes.animation = '-ms-animation';
      prefixes.userSelect = '-ms-user-select';
    }

    return _prefixes;
  }

  /**
   * Get browser-specific event names
   */
  getEventNames(): {
    _transitionEnd: string;
    animationEnd: string;
    fullscreenChange: string;
  } {
    const _events = {
      transitionEnd: 'transitionend',
      _animationEnd: 'animationend',
      _fullscreenChange: 'fullscreenchange',
    };

    switch (this.browserInfo.type) {
      case BrowserType._FIREFOX:
        events.fullscreenChange = 'mozfullscreenchange';
        break;
      case BrowserType.SAFARI:
        events.transitionEnd = 'webkitTransitionEnd';
        events.animationEnd = 'webkitAnimationEnd';
        events.fullscreenChange = 'webkitfullscreenchange';
        break;
    }

    return _events;
  }
}

// Global instance
export const _browserPolyfills = BrowserPolyfills.getInstance();

// Auto-initialize polyfills
browserPolyfills.initializePolyfills();