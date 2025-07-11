/*
 *  Copyright 2022 Collate.
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

let requestCounter = 0;

export function waitForServiceWorkerController(): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    if (navigator.serviceWorker.controller) {
      return resolve(navigator.serviceWorker.controller);
    }

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

    // Add timeout to avoid hanging forever
    setTimeout(() => {
      reject(new Error('Timed out waiting for service worker to take control'));
    }, 5000);
  });
}

export async function sendMessageToServiceWorker(
  data: Record<string, any>
): Promise<any> {
  const controller = await waitForServiceWorkerController();

  return new Promise((resolve, reject) => {
    const messageChannel = new MessageChannel();
    const requestId = `req_${requestCounter++}`;

    messageChannel.port1.onmessage = (event) => {
      if (event.data?.error) {
        reject(event.data.error);
      } else {
        resolve(event.data.result);
      }
    };

    controller.postMessage({ ...data, requestId }, [messageChannel.port2]);
  });
}
