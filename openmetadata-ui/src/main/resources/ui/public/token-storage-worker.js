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

const swStore = {};

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  const { type, key, value, requestId } = event.data;
  let result = null;

  switch (type) {
    case 'set':
      swStore[key] = value;

      break;
    case 'get':
      result = swStore[key] ?? null;

      break;
    case 'remove':
      result = swStore[key] ?? null;
      delete swStore[key];

      break;
    case 'getAllKeys':
      result = Object.keys(swStore);

      break;
  }

  event.ports[0].postMessage({ result, requestId });
});
