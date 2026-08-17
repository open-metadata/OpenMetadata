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

import { afterEach, describe, expect, it } from '@jest/globals';
import process from 'node:process';
import { getWebhookReceiverHost } from './webhook';

describe('getWebhookReceiverHost', () => {
  const originalIsOss = process.env.PLAYWRIGHT_IS_OSS;
  const originalWebhookHost = process.env.PLAYWRIGHT_WEBHOOK_HOST;
  const setEnvironmentVariable = (name, value) => {
    if (value === undefined) {
      delete process.env[name];

      return;
    }

    process.env[name] = value;
  };

  afterEach(() => {
    setEnvironmentVariable('PLAYWRIGHT_IS_OSS', originalIsOss);
    setEnvironmentVariable('PLAYWRIGHT_WEBHOOK_HOST', originalWebhookHost);
  });

  it('uses the configured webhook host for AUT runs', () => {
    delete process.env.PLAYWRIGHT_IS_OSS;
    process.env.PLAYWRIGHT_WEBHOOK_HOST =
      'playwright-runner.aut.svc.cluster.local';

    expect(getWebhookReceiverHost()).toBe(
      'playwright-runner.aut.svc.cluster.local'
    );
  });

  it.each([undefined, '', '   '])(
    'throws when the webhook host is %p for an AUT run',
    (webhookHost) => {
      delete process.env.PLAYWRIGHT_IS_OSS;
      setEnvironmentVariable('PLAYWRIGHT_WEBHOOK_HOST', webhookHost);

      expect(getWebhookReceiverHost).toThrow(
        'PLAYWRIGHT_WEBHOOK_HOST must be defined for AUT runs'
      );
    }
  );

  it('uses localhost for OSS runs', () => {
    process.env.PLAYWRIGHT_IS_OSS = 'true';
    process.env.PLAYWRIGHT_WEBHOOK_HOST = 'ignored-host';

    expect(getWebhookReceiverHost()).toBe('localhost');
  });
});
