/*
 *  Copyright 2025 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import {
  sendMessageToServiceWorker,
  waitForServiceWorkerController,
  waitForServiceWorkerReady,
} from './SwMessenger';

// Mock service worker interfaces
interface MockServiceWorker {
  postMessage: jest.Mock;
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  state?: string;
}

interface MockServiceWorkerRegistration {
  installing?: MockServiceWorker | null;
  waiting?: MockServiceWorker | null;
  active?: MockServiceWorker | null;
}

// Mock navigator.serviceWorker
const mockController = {
  postMessage: jest.fn(),
} as MockServiceWorker;

const mockRegistration = {
  installing: null,
  waiting: null,
  active: null,
} as MockServiceWorkerRegistration;

const mockServiceWorker = {
  controller: null as MockServiceWorker | null,
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  getRegistration: jest.fn(),
  register: jest.fn(),
};

Object.defineProperty(global, 'navigator', {
  value: {
    serviceWorker: mockServiceWorker,
  },
  writable: true,
});

// Mock MessageChannel
const mockMessageChannel = {
  port1: {
    onmessage: null as ((event: any) => void) | null,
  },
  port2: {},
};

Object.defineProperty(global, 'MessageChannel', {
  value: jest.fn(() => mockMessageChannel),
  writable: true,
});

describe('SwMessenger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    mockServiceWorker.controller = null;
    mockServiceWorker.getRegistration.mockResolvedValue(mockRegistration);
    mockRegistration.installing = null;
    mockRegistration.waiting = null;
    mockRegistration.active = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('waitForServiceWorkerController', () => {
    it('should resolve immediately if controller is already available', async () => {
      mockServiceWorker.controller = mockController;

      const result = await waitForServiceWorkerController();

      expect(result).toBe(mockController);
    });

    it('should wait for controllerchange event when controller is not ready', async () => {
      mockServiceWorker.controller = null;
      mockRegistration.active = mockController;

      // Mock the controllerchange event
      mockServiceWorker.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'controllerchange') {
            // Simulate async event
            process.nextTick(() => {
              mockServiceWorker.controller = mockController;
              handler();
            });
          }
        }
      );

      const result = await waitForServiceWorkerController();

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function)
      );
      expect(result).toBe(mockController);
    });

    it('should register service worker if no registration exists', async () => {
      mockServiceWorker.getRegistration.mockResolvedValueOnce(null);
      mockServiceWorker.getRegistration.mockResolvedValueOnce(null);
      mockServiceWorker.register.mockResolvedValue(mockRegistration);
      mockRegistration.active = mockController;

      mockServiceWorker.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'controllerchange') {
            process.nextTick(() => {
              mockServiceWorker.controller = mockController;
              handler();
            });
          }
        }
      );

      const result = await waitForServiceWorkerController();

      expect(mockServiceWorker.register).toHaveBeenCalledWith(
        '/app-worker.js',
        {
          scope: '/',
        }
      );
      expect(result).toBe(mockController);
    });

    it('should handle installing service worker', async () => {
      const installingWorker = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        removeEventListener: jest.fn(),
        state: 'installing',
      } as MockServiceWorker;

      mockServiceWorker.controller = null;
      mockRegistration.installing = installingWorker;
      mockRegistration.active = mockController;

      installingWorker.addEventListener.mockImplementation((event, handler) => {
        if (event === 'statechange') {
          process.nextTick(() => {
            installingWorker.state = 'activated';
            handler.call({ state: 'activated' });
          });
        }
      });

      mockServiceWorker.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'controllerchange') {
            process.nextTick(() => {
              mockServiceWorker.controller = mockController;
              handler();
            });
          }
        }
      );

      const result = await waitForServiceWorkerController();

      expect(installingWorker.addEventListener).toHaveBeenCalledWith(
        'statechange',
        expect.any(Function)
      );
      expect(result).toBe(mockController);
    });

    it('should handle waiting service worker', async () => {
      const waitingWorker = {
        addEventListener: jest.fn(),
        postMessage: jest.fn(),
        removeEventListener: jest.fn(),
        state: 'waiting',
      } as MockServiceWorker;

      mockServiceWorker.controller = null;
      mockRegistration.waiting = waitingWorker;
      mockRegistration.active = mockController;

      waitingWorker.addEventListener.mockImplementation((event, handler) => {
        if (event === 'statechange') {
          process.nextTick(() => {
            waitingWorker.state = 'activated';
            handler.call({ state: 'activated' });
          });
        }
      });

      mockServiceWorker.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'controllerchange') {
            process.nextTick(() => {
              mockServiceWorker.controller = mockController;
              handler();
            });
          }
        }
      );

      const result = await waitForServiceWorkerController();

      expect(waitingWorker.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
      expect(result).toBe(mockController);
    });

    it('should timeout after 15 seconds', async () => {
      jest.useFakeTimers();

      mockServiceWorker.controller = null;
      mockRegistration.active = mockController;

      mockServiceWorker.addEventListener.mockImplementation((event) => {
        if (event === 'controllerchange') {
          // Don't call handler to simulate timeout
        }
      });

      const promise = waitForServiceWorkerController();

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(15000);

      await expect(promise).rejects.toThrow(
        'Timed out waiting for service worker to take control'
      );
    });

    it('should handle registration errors', async () => {
      const error = new Error('Registration failed');
      mockServiceWorker.getRegistration.mockRejectedValue(error);

      await expect(waitForServiceWorkerController()).rejects.toThrow(
        'Registration failed'
      );
    });
  });

  describe('waitForServiceWorkerReady', () => {
    beforeEach(() => {
      mockServiceWorker.controller = mockController;
    });

    it('should resolve when service worker is ready', async () => {
      let messageHandler: (event: any) => void;

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: (handler) => {
          messageHandler = handler;
          // Simulate immediate response
          process.nextTick(() => {
            messageHandler({
              data: { result: { ready: true, timestamp: Date.now() } },
            });
          });
        },
        configurable: true,
      });

      await expect(waitForServiceWorkerReady()).resolves.toBeUndefined();

      expect(mockController.postMessage).toHaveBeenCalledWith(
        { type: 'ping' },
        [mockMessageChannel.port2]
      );
    });

    it('should retry when service worker is not ready', async () => {
      let attemptCount = 0;

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: (handler) => {
          process.nextTick(() => {
            attemptCount++;
            if (attemptCount < 3) {
              // Not ready for first two attempts
              handler({
                data: { result: { ready: false, timestamp: Date.now() } },
              });
            } else {
              // Ready on third attempt
              handler({
                data: { result: { ready: true, timestamp: Date.now() } },
              });
            }
          });
        },
        configurable: true,
      });

      await expect(waitForServiceWorkerReady()).resolves.toBeUndefined();

      expect(attemptCount).toBe(3);
    });

    it('should handle ping timeout errors gracefully', async () => {
      jest.useFakeTimers();

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: () => {
          // Simulate timeout by not calling handler
          // The function should handle this gracefully and continue to next attempt
        },
        configurable: true,
      });

      const promise = waitForServiceWorkerReady();

      // Advance timers to trigger timeout attempts
      jest.advanceTimersByTime(30000); // Beyond max attempts * delay

      // Should still resolve, just exhausting retries
      await expect(promise).resolves.toBeUndefined();
    });
  });

  describe('sendMessageToServiceWorker', () => {
    beforeEach(() => {
      mockServiceWorker.controller = mockController;
    });

    it('should send message and return response', async () => {
      const testMessage = { type: 'get', key: 'test-key' };
      const expectedResponse = 'test-value';

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: (handler) => {
          process.nextTick(() => {
            handler({
              data: { result: expectedResponse },
            });
          });
        },
        configurable: true,
      });

      const result = await sendMessageToServiceWorker(testMessage as any);

      expect(mockController.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          ...testMessage,
          requestId: expect.stringMatching(/^req_\d+$/),
        }),
        [mockMessageChannel.port2]
      );
      expect(result).toBe(expectedResponse);
    });

    it('should handle service worker errors', async () => {
      const testMessage = { type: 'get', key: 'test-key' };
      const errorMessage = 'Service worker error';

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: (handler) => {
          process.nextTick(() => {
            handler({
              data: { error: errorMessage },
            });
          });
        },
        configurable: true,
      });

      await expect(
        sendMessageToServiceWorker(testMessage as any)
      ).rejects.toThrow(errorMessage);
    });

    it('should timeout after 15 seconds', async () => {
      jest.useFakeTimers();

      const testMessage = { type: 'get', key: 'test-key' };

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: () => {
          // Don't call the handler, let timeout occur
        },
        configurable: true,
      });

      const promise = sendMessageToServiceWorker(testMessage as any);

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(15000);

      await expect(promise).rejects.toThrow('Service Worker message timeout');
    });

    it('should handle controller unavailable error', async () => {
      mockServiceWorker.controller = null;
      const testMessage = { type: 'get', key: 'test-key' };

      await expect(
        sendMessageToServiceWorker(testMessage as any)
      ).rejects.toThrow('Service Worker unavailable');
    });

    it('should increment request counter for unique request IDs', async () => {
      const testMessage = { type: 'ping' };

      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: (handler) => {
          process.nextTick(() => {
            handler({ data: { result: 'pong' } });
          });
        },
        configurable: true,
      });

      // Send two messages
      await sendMessageToServiceWorker(testMessage as any);
      await sendMessageToServiceWorker(testMessage as any);

      // Check that different request IDs were used
      const calls = mockController.postMessage.mock.calls;

      expect(calls[0][0].requestId).toMatch(/^req_\d+$/);
      expect(calls[1][0].requestId).toMatch(/^req_\d+$/);
      expect(calls[0][0].requestId).not.toBe(calls[1][0].requestId);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete flow from controller wait to message sending', async () => {
      // Start with no controller
      mockServiceWorker.controller = null;
      mockRegistration.active = mockController;

      // Mock controllerchange event
      mockServiceWorker.addEventListener.mockImplementation(
        (event, handler) => {
          if (event === 'controllerchange') {
            process.nextTick(() => {
              mockServiceWorker.controller = mockController;
              handler();
            });
          }
        }
      );

      // Mock successful message response
      Object.defineProperty(mockMessageChannel.port1, 'onmessage', {
        set: (handler) => {
          process.nextTick(() => {
            handler({ data: { result: 'success' } });
          });
        },
        configurable: true,
      });

      const result = await sendMessageToServiceWorker({ type: 'ping' } as any);

      expect(result).toBe('success');
    });
  });
});
