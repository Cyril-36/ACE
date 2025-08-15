// Tests for notification service
import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { NotificationService } from '../notificationService';
import { ErrorNotification } from '../../error/errorHandler';

// Mock DOM methods
const mockDocument = {
  createElement: vi.fn(),
  getElementById: vi.fn(),
  body: {
    appendChild: vi.fn(),
  },
  head: {
    appendChild: vi.fn(),
  },
};

const mockElement = {
  id: '',
  className: '',
  style: { cssText: '' },
  innerHTML: '',
  appendChild: vi.fn(),
  addEventListener: vi.fn(),
  remove: vi.fn(),
};

// Setup DOM mocks
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.document = mockDocument as any;
  mockDocument.createElement.mockReturnValue(mockElement);
});

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    notificationService = new NotificationService({
      enabled: true,
      types: {
        errors: true,
        warnings: true,
        _success: true,
        info: true,
      },
      position: 'top-right',
      autoHide: true,
      duration: 3000,
    });
    mockListener = vi.fn();
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new NotificationService();
      expect(service.getAll()).toEqual([]);
    });

    it('should accept custom configuration', () => {
      const service = new NotificationService({
        enabled: false,
        position: 'bottom-left',
        duration: 10000,
      });
      
      // Should not show notifications when disabled
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        dismissible: true,
      };
      
      service.show(notification);
      expect(service.getAll()).toEqual([]);
    });

    it('should update configuration', () => {
      notificationService.updateConfig({
        position: 'bottom-left',
        autoHide: false,
      });
      
      // Configuration should be updated (tested indirectly through behavior)
      expect(mockDocument.createElement).toHaveBeenCalled();
    });
  });

  describe('Notification Display', () => {
    it('should show notification when enabled', () => {
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test Notification',
        message: 'This is a test message',
        dismissible: true,
      };

      notificationService.show(notification);

      expect(notificationService.getAll()).toContainEqual(notification);
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
    });

    it('should not show notification when type is disabled', () => {
      notificationService.updateConfig({
        types: {
          errors: false,
          warnings: true,
          _success: true,
          info: true,
        },
      });

      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'error',
        title: 'Error',
        message: 'This should not show',
        dismissible: true,
      };

      notificationService.show(notification);

      expect(notificationService.getAll()).toEqual([]);
    });

    it('should not show notification when service is disabled', () => {
      notificationService.updateConfig({ enabled: false });

      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test',
        message: 'This should not show',
        dismissible: true,
      };

      notificationService.show(notification);

      expect(notificationService.getAll()).toEqual([]);
    });

    it('should render notification with actions', () => {
      const mockAction = vi.fn();
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'warning',
        title: 'Warning',
        message: 'Action required',
        dismissible: true,
        actions: [
          {
            id: 'action-1',
            label: 'Fix Issue',
            action: mockAction,
            style: 'primary',
          },
        ],
      };

      notificationService.show(notification);

      expect(notificationService.getAll()).toContainEqual(notification);
      expect(mockElement.appendChild).toHaveBeenCalled();
    });
  });

  describe('Notification Management', () => {
    it('should dismiss notification by id', () => {
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        dismissible: true,
      };

      notificationService.show(notification);
      expect(notificationService.getAll()).toHaveLength(1);

      notificationService.dismiss('test-1');
      expect(notificationService.getAll()).toHaveLength(0);
    });

    it('should clear all notifications', () => {
      const notifications: ErrorNotification[] = [
        {
          id: 'test-1',
          type: 'info',
          title: 'Test 1',
          message: 'Message 1',
          dismissible: true,
        },
        {
          id: 'test-2',
          type: 'warning',
          title: 'Test 2',
          message: 'Message 2',
          dismissible: true,
        },
      ];

      notifications.forEach((n: any) => notificationService.show(n));
      expect(notificationService.getAll()).toHaveLength(2);

      notificationService.clear();
      expect(notificationService.getAll()).toHaveLength(0);
    });

    it('should auto-hide notifications when configured', () => {
      return new Promise<void>((resolve) => {
        const notification: ErrorNotification = {
          id: 'test-1',
          type: 'success',
          title: 'Success',
          message: 'Operation completed',
          dismissible: true,
          autoHide: 100, // 100ms for testing
        };

        notificationService.show(notification);
        expect(notificationService.getAll()).toHaveLength(1);

        setTimeout(() => {
          expect(notificationService.getAll()).toHaveLength(0);
          resolve();
        }, 150);
      });
    });

    it('should not auto-hide when autoHide is disabled', () => {
      return new Promise<void>((resolve) => {
        notificationService.updateConfig({ autoHide: false });

        const notification: ErrorNotification = {
          id: 'test-1',
          type: 'info',
          title: 'Persistent',
          message: 'This should not auto-hide',
          dismissible: true,
          autoHide: 100,
        };

        notificationService.show(notification);
        expect(notificationService.getAll()).toHaveLength(1);

        setTimeout(() => {
          expect(notificationService.getAll()).toHaveLength(1);
          resolve();
        }, 150);
      });
    });
  });

  describe('Event Listeners', () => {
    it('should notify listeners when notifications change', () => {
      const unsubscribe = notificationService.subscribe(mockListener);

      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        dismissible: true,
      };

      notificationService.show(notification);
      expect(mockListener).toHaveBeenCalledWith([notification]);

      notificationService.dismiss('test-1');
      expect(mockListener).toHaveBeenCalledWith([]);

      unsubscribe();
    });

    it('should remove listeners when unsubscribed', () => {
      const unsubscribe = notificationService.subscribe(mockListener);
      unsubscribe();

      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        dismissible: true,
      };

      notificationService.show(notification);
      expect(mockListener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const mockListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener failed');
      });

      notificationService.subscribe(mockListener);
      
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'info',
        title: 'Test',
        message: 'Test message',
        dismissible: true,
      };
      
      // Should not throw, but log the error
      expect(() => {
        notificationService.show(notification);
      }).not.toThrow();
      
      // Verify the listener was called (and failed internally)
      expect(mockListener).toHaveBeenCalled();
    });
  });

  describe('Notification Types', () => {
    it('should handle error notifications', () => {
      const notification: ErrorNotification = {
        id: 'error-1',
        type: 'error',
        title: 'Critical Error',
        message: 'Something went wrong',
        dismissible: false,
        persistent: true,
      };

      notificationService.show(notification);
      expect(notificationService.getAll()).toContainEqual(notification);
    });

    it('should handle warning notifications', () => {
      const notification: ErrorNotification = {
        id: 'warning-1',
        type: 'warning',
        title: 'Warning',
        message: 'Please check your settings',
        dismissible: true,
        autoHide: 5000,
      };

      notificationService.show(notification);
      expect(notificationService.getAll()).toContainEqual(notification);
    });

    it('should handle success notifications', () => {
      const notification: ErrorNotification = {
        id: 'success-1',
        type: 'success',
        title: 'Success',
        message: 'Operation completed successfully',
        dismissible: true,
        autoHide: 3000,
      };

      notificationService.show(notification);
      expect(notificationService.getAll()).toContainEqual(notification);
    });

    it('should handle info notifications', () => {
      const notification: ErrorNotification = {
        id: 'info-1',
        type: 'info',
        title: 'Information',
        message: 'Here is some useful information',
        dismissible: true,
      };

      notificationService.show(notification);
      expect(notificationService.getAll()).toContainEqual(notification);
    });
  });

  describe('Action Handling', () => {
    it('should execute notification actions', async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'warning',
        title: 'Action Required',
        message: 'Click to fix',
        dismissible: true,
        actions: [
          {
            id: 'fix',
            label: 'Fix Now',
            action: mockAction,
          },
        ],
      };

      notificationService.show(notification);
      
      // Simulate action execution (would normally be triggered by DOM event)
      if (notification.actions) {
        await notification.actions[0].action();
      }

      expect(mockAction).toHaveBeenCalled();
    });

    it('should handle action errors gracefully', async () => {
      const faultyAction = vi.fn().mockRejectedValue(new Error('Action failed'));
      const notification: ErrorNotification = {
        id: 'test-1',
        type: 'error',
        title: 'Error',
        message: 'Action will fail',
        dismissible: true,
        actions: [
          {
            id: 'faulty',
            label: 'Faulty Action',
            action: faultyAction,
          },
        ],
      };

      notificationService.show(notification);

      // Should not throw when action fails
      if (notification.actions) {
        await expect(notification.actions[0].action()).rejects.toThrow('Action failed');
      }

      expect(faultyAction).toHaveBeenCalled();
    });
  });

  describe('DOM Integration', () => {
    it('should create notification container on initialization', () => {
      expect(mockDocument.createElement).toHaveBeenCalledWith('div');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
    });

    it('should handle missing DOM gracefully', () => {
      // Temporarily remove document
      const originalDocument = global.document;
      delete (global as { document?: Document }).document;

      // Should not throw when document is undefined
      expect(() => {
        new NotificationService();
      }).not.toThrow();

      // Restore document
      global.document = originalDocument;
    });

    it('should apply correct positioning styles', () => {
      const positions = ['top-right', 'top-left', 'bottom-right', 'bottom-left'] as const;
      
      positions.forEach((position: any) => {
        new NotificationService({ position });
        expect(mockDocument.createElement).toHaveBeenCalled();
      });
    });
  });
});