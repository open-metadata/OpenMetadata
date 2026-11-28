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
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { LimitBanner } from '../components/common/LimitBanner/LimitBanner';
import { useLimitStore } from '../context/LimitsProvider/useLimitsStore';
import { LimitConfig } from '../interface/platform/limits.interface';
import { worker } from '../test/browser/msw';
import { renderWithApp } from '../test/browser/renderWithApp';
import { scaled } from '../test/browser/timeouts';
import LimitWrapper from './LimitWrapper';

const LIMITS_ON: LimitConfig = {
  enable: true,
  limits: {
    config: {
      version: 'test',
      plan: 'FREE',
      installationType: 'test',
      deployment: 'test',
      companyName: 'test',
      domain: 'test',
      instances: 1,
      featureLimits: [],
    },
  },
};

const overLimit = (resource: string, hardLimit: number) => ({
  featureLimitStatuses: [
    {
      name: resource,
      limitReached: true,
      currentCount: hardLimit,
      configuredLimit: {
        name: resource,
        maxVersions: 0,
        disableFields: [],
        limits: { softLimit: hardLimit - 1, hardLimit },
      },
    },
  ],
});

const withinLimit = (resource: string) => ({
  featureLimitStatuses: [
    {
      name: resource,
      limitReached: false,
      currentCount: 1,
      configuredLimit: {
        name: resource,
        maxVersions: 0,
        disableFields: [],
        limits: { softLimit: 2, hardLimit: 3 },
      },
    },
  ],
});

// Mimics the table-details-page + Profiler-tab pattern: the table LimitWrapper
// is always mounted; the dataQuality LimitWrapper mounts only while its tab is
// active, and unmounts when the user switches away — exactly the unmount that
// used to clobber the table banner. State-driven so a single click toggles the
// wrapper without a `rerender` (which can throw a second React instance).
const TabbedLimitPage = () => {
  const [showDataQualityTab, setShowDataQualityTab] = useState(true);

  return (
    <>
      <LimitBanner />
      {/* Always-on wrapper for the table resource (raises the banner). */}
      <LimitWrapper resource="table">
        <span />
      </LimitWrapper>
      {/* The Profiler-tab wrapper, mounted only while its tab is active. */}
      {showDataQualityTab ? (
        <LimitWrapper resource="dataQuality">
          <button type="button">Add table test</button>
        </LimitWrapper>
      ) : null}
      <button
        data-testid="switch-tab"
        type="button"
        onClick={() => setShowDataQualityTab(false)}>
        switch
      </button>
    </>
  );
};

describe('LimitBanner cross-resource unmount', () => {
  afterEach(() => {
    useLimitStore.setState(useLimitStore.getInitialState(), true);
  });

  test(
    'keeps the table banner after the dataQuality wrapper unmounts',
    async () => {
      worker.use(
        http.get('/api/v1/limits/features/table', () =>
          HttpResponse.json(overLimit('table', 3))
        ),
        http.get('/api/v1/limits/features/dataQuality', () =>
          HttpResponse.json(withinLimit('dataQuality'))
        )
      );
      useLimitStore.setState({ config: LIMITS_ON, bannerDetails: null });

      renderWithApp(<TabbedLimitPage />, {
        url: '/table/svc.db.schema.orders',
        path: '/table/:fqn',
      });

      // The table is over its hard limit (3/3) -> banner appears.
      const banner = page.getByText(/3\/3 \(FREE, 100%\)/);

      await expect.element(banner, { timeout: scaled(30_000) }).toBeVisible();

      // Switch away from the Profiler tab: the dataQuality wrapper unmounts.
      await userEvent.click(page.getByTestId('switch-tab'));

      // The table banner must survive the dataQuality wrapper unmount.
      await expect.element(banner).toBeVisible();
      await expect
        .poll(() =>
          document
            .querySelector('header.pricing-banner')
            ?.hasAttribute('hidden')
        )
        .toBe(false);
    },
    scaled(60_000)
  );
});
