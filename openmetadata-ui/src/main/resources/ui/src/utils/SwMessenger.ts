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

// Service Worker message and response types
type ServiceWorkerMessage =
  | { type: 'ping' }
  | { type: 'set'; key: string; value: string }
  | { type: 'get'; key: string }
  | { type: 'delete' | 'remove'; key: string }
  | { type: 'getAllKeys' };

let requestCounter = 0;

export function waitForServiceWorkerController(): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    if (navigator.serviceWorker.controller) {
      return resolve(navigator.serviceWorker.controller);
    }

    const waitForRegistrationAndController = async () => {
      try {
        let registration = await navigator.serviceWorker.getRegistration();

        // If no registration, wait a bit and try again
        if (!registration) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          registration = await navigator.serviceWorker.getRegistration();
        }

        // If there is still no registration, create a new one
        if (!registration) {
          registration = await navigator.serviceWorker.register(
            '/app-worker.js',
            {
              scope: '/',
            }
          );
        }

        // Wait for the service worker to be ready
        if (registration.installing) {
          const installingWorker = registration.installing;
          await new Promise<void>((resolve) => {
            installingWorker.addEventListener('statechange', function () {
              if (this.state === 'activated') {
                resolve();
              }
            });
          });
        }

        if (registration.waiting) {
          const waitingWorker = registration.waiting;
          waitingWorker.postMessage({ type: 'SKIP_WAITING' });
          await new Promise<void>((resolve) => {
            waitingWorker.addEventListener('statechange', function () {
              if (this.state === 'activated') {
                resolve();
              }
            });
          });
        }

        // If the active service worker is not the controller, post a message to skip waiting
        if (registration.active && !navigator.serviceWorker.controller) {
          registration.active.postMessage({ type: 'SKIP_WAITING' });
        }

        // If the controller is ready, resolve the promise
        if (navigator.serviceWorker.controller) {
          resolve(navigator.serviceWorker.controller);

          return;
        }

        // If the controller is not ready, add a controllerchange event listener to wait for it to be ready
        const controllerChangeHandler = () => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.removeEventListener(
              'controllerchange',
              controllerChangeHandler
            );
            resolve(navigator.serviceWorker.controller);
          }
        };

        navigator.serviceWorker.addEventListener(
          'controllerchange',
          controllerChangeHandler
        );

        // If the controller is not ready, reject the promise after 15 seconds
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener(
            'controllerchange',
            controllerChangeHandler
          );
          reject(
            new Error('Timed out waiting for service worker to take control')
          );
        }, 15000);
      } catch (error) {
        reject(error);
      }
    };

    waitForRegistrationAndController();
  });
}

export async function waitForServiceWorkerReady(): Promise<void> {
  const controller = await waitForServiceWorkerController();

  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await new Promise<{ ready: boolean; timestamp: number }>(
        (resolve, reject) => {
          const messageChannel = new MessageChannel();
          const timeout = setTimeout(() => {
            reject(new Error('Service Worker ping timeout'));
          }, 1000);

          messageChannel.port1.onmessage = (event) => {
            clearTimeout(timeout);
            resolve(event.data.result);
          };

          controller.postMessage({ type: 'ping' }, [messageChannel.port2]);
        }
      );

      if (response?.ready) {
        return;
      }
    } catch {
      // Continue to next attempt
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

export async function sendMessageToServiceWorker(
  data: ServiceWorkerMessage
): Promise<unknown> {
  try {
    const controller = await waitForServiceWorkerController();

    return new Promise((resolve, reject) => {
      // Create a new message channel to send the message to the service worker
      const messageChannel = new MessageChannel();
      const requestId = `req_${requestCounter++}`;

      // Set a timeout of 15 seconds to reject the promise if the service worker does not respond
      const timeout = setTimeout(() => {
        reject(new Error('Service Worker message timeout'));
      }, 15000);

      // On message received, clear the timeout and resolve or reject the promise based on the event data
      messageChannel.port1.onmessage = (event) => {
        clearTimeout(timeout);
        if (event.data?.error) {
          reject(new Error(event.data.error));
        } else {
          resolve(event.data.result);
        }
      };

      // Send the message to the service worker
      controller.postMessage({ ...data, requestId }, [messageChannel.port2]);
    });
  } catch (error) {
    throw new Error(`Service Worker unavailable: ${(error as Error).message}`);
  }
}
