/*
 *  Copyright 2026 Collate.
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

import { createServer, type Server } from 'http';
import { ChangeEvent } from '../../src/generated/type/changeEvent';

interface CapturedWebhookRequest {
  body: string;
  method?: string;
}

// Allow room for validation and retry bursts while keeping receiver state bounded.
const MAX_CAPTURED_WEBHOOK_REQUESTS = 100;
const capturedWebhookRequests: CapturedWebhookRequest[] = [];
let webhookServer: Server | undefined;

export const getWebhookReceiverHost = () => {
  if (process.env.PLAYWRIGHT_IS_OSS) {
    return 'localhost';
  }

  const webhookHost = process.env.PLAYWRIGHT_WEBHOOK_HOST?.trim();
  if (!webhookHost) {
    throw new Error(
      'PLAYWRIGHT_WEBHOOK_HOST must be defined for AUT runs because the OpenMetadata pod cannot reach the Playwright webhook receiver through localhost.'
    );
  }

  return webhookHost;
};

export const startWebhookReceiver = async () => {
  const webhookReceiverHost = getWebhookReceiverHost();
  const server = createServer((request, response) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      // Preserve nearby validation or retry traffic without allowing receiver state to grow unbounded.
      capturedWebhookRequests.push({
        body,
        method: request.method,
      });
      capturedWebhookRequests.splice(
        0,
        Math.max(
          0,
          capturedWebhookRequests.length - MAX_CAPTURED_WEBHOOK_REQUESTS
        )
      );

      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end('{}');
    });
  });
  webhookServer = server;

  return new Promise<string>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '0.0.0.0', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Webhook receiver did not bind to a TCP port'));

        return;
      }

      // CI can advertise the host through which a containerized server reaches this process.
      resolve(
        `http://${webhookReceiverHost}:${address.port}/observability-alert`
      );
    });
  });
};

export const stopWebhookReceiver = async () => {
  await new Promise<void>((resolve, reject) => {
    if (!webhookServer) {
      resolve();

      return;
    }

    webhookServer.close((error) => (error ? reject(error) : resolve()));
  });
  webhookServer = undefined;
};

export const clearCapturedWebhookRequests = () => {
  capturedWebhookRequests.length = 0;
};

export const getAddedColumnNames = (payload: ChangeEvent) => {
  const addedColumns = payload.changeDescription?.fieldsAdded?.find(
    (field) => field.name === 'columns'
  )?.newValue;

  if (typeof addedColumns !== 'string') {
    return [];
  }

  try {
    // FieldChange values are JSON strings inside the serialized ChangeEvent payload.
    const columns = JSON.parse(addedColumns) as Array<{ name?: string }>;

    return Array.isArray(columns)
      ? columns.flatMap((column) => (column.name ? [column.name] : []))
      : [];
  } catch {
    return [];
  }
};

export const findWebhookDelivery = (
  entityId: string,
  addedColumnName: string
) => {
  for (let index = capturedWebhookRequests.length - 1; index >= 0; index--) {
    const request = capturedWebhookRequests[index];

    if (request.method !== 'POST') {
      continue;
    }

    try {
      const payload = JSON.parse(request.body) as ChangeEvent;
      if (
        payload.entityId === entityId &&
        payload.eventType === 'entityUpdated' &&
        getAddedColumnNames(payload).includes(addedColumnName)
      ) {
        return { payload, request };
      }
    } catch {
      continue;
    }
  }

  return undefined;
};
