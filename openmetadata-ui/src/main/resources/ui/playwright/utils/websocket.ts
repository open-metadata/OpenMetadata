/*
 *  Copyright 2024 Collate.
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

import { Page, WebSocketRoute } from '@playwright/test';

/**
 * A reusable WebSocket mock for Playwright tests.
 * Fully mocks Socket.io connections without connecting to the real server.
 */
class WebSocketMock {
  private wsRoute: WebSocketRoute | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Sets up a mocked WebSocket that handles Socket.io/Engine.IO protocol.
   * Call this BEFORE navigating to the page.
   *
   * @param page - Playwright page
   * @param urlPattern - WebSocket URL pattern to intercept (default: /push\/feed/)
   */
  async setup(page: Page, urlPattern = /push\/feed/) {
    await page.routeWebSocket(urlPattern, (ws) => {
      this.wsRoute = ws;

      // Engine.IO OPEN packet
      ws.send(
        `0${JSON.stringify({
          sid: `mock-${Date.now()}`,
          upgrades: [],
          pingInterval: 25000,
          pingTimeout: 20000,
        })}`
      );

      ws.onMessage((message) => {
        if (typeof message === 'string') {
          // Engine.IO PING -> PONG
          if (message === '2') {
            ws.send('3');
            return;
          }
          // Socket.io CONNECT -> CONNECT ACK
          if (message === '40') {
            ws.send('40{"sid":"mock-socket"}');
            return;
          }
        }
      });

      // Keep connection alive
      this.pingInterval = setInterval(() => {
        try {
          ws.send('2');
        } catch {
          // Connection closed
        }
      }, 20000);

      ws.onClose(() => {
        this.cleanup();
      });
    });
  }

  /**
   * Emits a Socket.io event to the browser.
   * The data will be JSON stringified (as the app expects).
   *
   * @param event - Event name (e.g., 'deleteEntityChannel', 'taskChannel')
   * @param data - Event payload
   */
  emit(event: string, data: unknown) {
    if (!this.wsRoute) {
      throw new Error('WebSocket not set up. Call setup() first.');
    }
    // Socket.io format: 42["eventName","stringifiedData"]
    // Double stringify because the app does JSON.parse on the data
    const message = `42["${event}",${JSON.stringify(JSON.stringify(data))}]`;
    this.wsRoute.send(message);
  }

  /**
   * Cleans up the mock. Call this in afterEach or finally blocks.
   */
  cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.wsRoute = null;
  }

  /**
   * Check if the WebSocket is set up and ready.
   */
  get isReady(): boolean {
    return this.wsRoute !== null;
  }
}

// Singleton instance for simple usage
let defaultMock: WebSocketMock | null = null;

/**
 * Gets or creates the default WebSocket mock instance.
 */
export const getWebSocketMock = (): WebSocketMock => {
  if (!defaultMock) {
    defaultMock = new WebSocketMock();
  }
  return defaultMock;
};

/**
 * Creates a new WebSocket mock instance.
 * Use this when you need multiple independent mocks.
 */
export const createWebSocketMock = (): WebSocketMock => {
  return new WebSocketMock();
};

/**
 * Convenience: Sets up the default WebSocket mock.
 */
export const setupWebSocketMock = async (
  page: Page,
  urlPattern?: RegExp
): Promise<WebSocketMock> => {
  const mock = getWebSocketMock();
  await mock.setup(page, urlPattern);
  return mock;
};

/**
 * Convenience: Emits an event using the default mock.
 */
export const emitWebSocketEvent = (event: string, data: unknown) => {
  getWebSocketMock().emit(event, data);
};

/**
 * Convenience: Cleans up the default mock.
 */
export const cleanupWebSocketMock = () => {
  if (defaultMock) {
    defaultMock.cleanup();
    defaultMock = null;
  }
};

