// User notification service for error handling and system messages
import { ErrorNotification } from '../error/errorHandler';
import { NotificationConfig } from '../../types';

export interface NotificationState {
  notifications: ErrorNotification[];
  config: NotificationConfig;
}

export class NotificationService {
  private notifications: Map<string, ErrorNotification> = new Map();
  private config: NotificationConfig;
  private listeners: Set<(notifications: ErrorNotification[]) => void> = new Set();
  private container?: HTMLElement;

  constructor(config?: Partial<NotificationConfig>) {
    this.config = {
      enabled: true,
      types: {
        errors: true,
        warnings: true,
        success: true,
        info: true,
      },
      position: 'top-right',
      autoHide: true,
      duration: 5000,
      ...config,
    };

    this.initializeContainer();
  }

  /**
   * Map notification type to config key
   */
  private getConfigKey(type: string): keyof NotificationConfig['types'] {
    const typeMap: Record<string, keyof NotificationConfig['types']> = {
      'error': 'errors',
      'warning': 'warnings',
      'success': 'success',
      'info': 'info'
    };
    return typeMap[type] || type as keyof NotificationConfig['types'];
  }

  /**
   * Show a notification
   */
  show(notification: ErrorNotification): void {
    if (!this.config.enabled || !this.config.types[this.getConfigKey(notification.type)]) {
      return;
    }

    this.notifications.set(notification.id, notification);
    this.renderNotification(notification);
    this.notifyListeners();

    // Auto-hide if configured
    if (notification.autoHide && this.config.autoHide) {
      setTimeout(() => {
        this.dismiss(notification.id);
      }, notification.autoHide);
    }
  }

  /**
   * Dismiss a notification
   */
  dismiss(id: string): void {
    const notification = this.notifications.get(id);
    if (notification) {
      this.notifications.delete(id);
      this.removeNotificationElement(id);
      this.notifyListeners();
    }
  }

  /**
   * Clear all notifications
   */
  clear(): void {
    this.notifications.clear();
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.notifyListeners();
  }

  /**
   * Get all active notifications
   */
  getAll(): ErrorNotification[] {
    return Array.from(this.notifications.values());
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: (notifications: ErrorNotification[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Update notification configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    this.updateContainerPosition();
  }

  private initializeContainer(): void {
    // Only create container in browser environment
    if (typeof document === 'undefined') return;

    this.container = document.createElement('div');
    this.container.id = 'ace-notifications';
    this.container.className = `ace-notifications ace-notifications--${this.config.position}`;
    
    // Add styles
    this.container.style.cssText = `
      position: fixed;
      z-index: 10000;
      max-width: 400px;
      pointer-events: none;
      ${this.getPositionStyles()}
    `;

    document.body.appendChild(this.container);
  }

  private getPositionStyles(): string {
    switch (this.config.position) {
      case 'top-right':
        return 'top: 20px; right: 20px;';
      case 'top-left':
        return 'top: 20px; left: 20px;';
      case 'bottom-right':
        return 'bottom: 20px; right: 20px;';
      case 'bottom-left':
        return 'bottom: 20px; left: 20px;';
      default:
        return 'top: 20px; right: 20px;';
    }
  }

  private updateContainerPosition(): void {
    if (this.container) {
      this.container.className = `ace-notifications ace-notifications--${this.config.position}`;
      this.container.style.cssText = `
        position: fixed;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
        ${this.getPositionStyles()}
      `;
    }
  }

  private renderNotification(notification: ErrorNotification): void {
    if (!this.container) return;

    const element = document.createElement('div');
    element.id = `notification-${notification.id}`;
    element.className = `ace-notification ace-notification--${notification.type}`;
    element.style.cssText = `
      background: ${this.getBackgroundColor(notification.type)};
      color: ${this.getTextColor(notification.type)};
      border: 1px solid ${this.getBorderColor(notification.type)};
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      animation: slideIn 0.3s ease-out;
      max-width: 100%;
      word-wrap: break-word;
    `;

    // Create notification content
    const content = document.createElement('div');
    content.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
        <h4 style="margin: 0; font-size: 14px; font-weight: 600;">${this.escapeHtml(notification.title)}</h4>
        ${notification.dismissible ? `
          <button 
            onclick="this.closest('.ace-notification').remove()" 
            style="background: none; border: none; font-size: 18px; cursor: pointer; padding: 0; margin-left: 12px; opacity: 0.7;"
            aria-label="Dismiss notification"
          >×</button>
        ` : ''}
      </div>
      <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.4; opacity: 0.9;">
        ${this.escapeHtml(notification.message)}
      </p>
    `;

    // Add actions if present
    if (notification.actions && notification.actions.length > 0) {
      const actionsContainer = document.createElement('div');
      actionsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';

      notification.actions.forEach((action: any) => {
        const button = document.createElement('button');
        button.textContent = action.label;
        button.style.cssText = `
          background: ${this.getActionButtonColor(action.style || 'secondary')};
          color: white;
          border: none;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
          transition: opacity 0.2s;
        `;
        
        button.addEventListener('click', async () => {
          try {
            await action.action();
            this.dismiss(notification.id);
          } catch (error) {
            console.error('Notification action failed:', error);
          }
        });

        button.addEventListener('mouseenter', () => {
          button.style.opacity = '0.8';
        });

        button.addEventListener('mouseleave', () => {
          button.style.opacity = '1';
        });

        actionsContainer.appendChild(button);
      });

      content.appendChild(actionsContainer);
    }

    element.appendChild(content);

    // Add dismiss functionality
    if (notification.dismissible) {
      element.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).tagName === 'BUTTON') return;
        this.dismiss(notification.id);
      });
    }

    this.container.appendChild(element);

    // Add animation styles if not already present
    if (!document.getElementById('ace-notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'ace-notification-styles';
      styles.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        .ace-notification:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
          transition: all 0.2s ease;
        }
      `;
      document.head.appendChild(styles);
    }
  }

  private removeNotificationElement(id: string): void {
    const element = document.getElementById(`notification-${id}`);
    if (element) {
      element.style.animation = 'slideOut 0.3s ease-in forwards';
      element.addEventListener('animationend', () => {
        element.remove();
      });

      // Add slideOut animation if not present
      if (!document.getElementById('ace-notification-slideout')) {
        const styles = document.createElement('style');
        styles.id = 'ace-notification-slideout';
        styles.textContent = `
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(styles);
      }
    }
  }

  private getBackgroundColor(type: string): string {
    const colors = {
      error: '#fee2e2',
      warning: '#fef3c7',
      success: '#d1fae5',
      info: '#dbeafe',
    };
    return colors[type as keyof typeof colors] || colors.info;
  }

  private getTextColor(type: string): string {
    const colors = {
      error: '#991b1b',
      warning: '#92400e',
      success: '#065f46',
      info: '#1e40af',
    };
    return colors[type as keyof typeof colors] || colors.info;
  }

  private getBorderColor(type: string): string {
    const colors = {
      error: '#fca5a5',
      warning: '#fcd34d',
      success: '#6ee7b7',
      info: '#93c5fd',
    };
    return colors[type as keyof typeof colors] || colors.info;
  }

  private getActionButtonColor(style: string): string {
    const colors = {
      primary: '#3b82f6',
      secondary: '#6b7280',
      danger: '#ef4444',
    };
    return colors[style as keyof typeof colors] || colors.secondary;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private notifyListeners(): void {
    const notifications = this.getAll();
    this.listeners.forEach((listener: any) => {
      try {
        listener(notifications);
      } catch (error) {
        console.error('Notification listener error: ', error);
      }
    });
  }
}

// Global notification service instance
export const globalNotificationService = new NotificationService();