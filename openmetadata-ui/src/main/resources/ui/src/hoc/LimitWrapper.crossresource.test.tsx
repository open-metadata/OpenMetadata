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

import { render, screen, waitFor } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../context/LimitsProvider/useLimitsStore';
import { getLimitByResource } from '../rest/limitsAPI';
import LimitWrapper from './LimitWrapper';

// Only the network layer is mocked; the real zustand store drives the banner,
// so this test exercises the same ownership semantics the app relies on.
jest.mock('../rest/limitsAPI');

const mockGetLimitByResource = getLimitByResource as jest.MockedFunction<
  typeof getLimitByResource
>;

const getConfig = () => ({
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
});

const getLimitResponse = (
  currentCount: number,
  limitReached: boolean,
  resource: string,
  hardLimit = 3,
  softLimit = 2
) => ({
  featureLimitStatuses: [
    {
      name: resource,
      limitReached,
      currentCount,
      configuredLimit: {
        name: resource,
        limits: { softLimit, hardLimit },
      },
    },
  ],
});

describe('LimitWrapper cross-resource banner ownership', () => {
  beforeEach(() => {
    useLimitStore.setState({
      config: getConfig(),
      resourceLimit: {},
      bannerDetails: null,
    });
    mockGetLimitByResource.mockReset();
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
      i18n: { language: 'en-US', dir: jest.fn().mockReturnValue('ltr') },
    });
  });

  it('does not retract another resource banner when a different resource wrapper unmounts', async () => {
    // table is over its hard limit (3/3, limitReached); dataQuality is within
    // limits (1/3, not reached).
    mockGetLimitByResource.mockImplementation((resource) => {
      if (resource === 'table') {
        return Promise.resolve(getLimitResponse(3, true, 'table'));
      }
      if (resource === 'dataQuality') {
        return Promise.resolve(getLimitResponse(1, false, 'dataQuality'));
      }

      return Promise.resolve(getLimitResponse(0, false, resource));
    });

    // 1. Mount the table wrapper -> banner raised for table.
    const { unmount: unmountTable } = render(
      <LimitWrapper resource="table">
        <button type="button">Table</button>
      </LimitWrapper>
    );

    await waitFor(() =>
      expect(useLimitStore.getState().bannerDetails?.resource).toBe('table')
    );

    // 2. Mount the dataQuality wrapper (within limits) -> table banner survives.
    const { unmount: unmountDataQuality } = render(
      <LimitWrapper resource="dataQuality">
        <button type="button">Data Quality</button>
      </LimitWrapper>
    );

    await waitFor(() =>
      expect(useLimitStore.getState().bannerDetails?.resource).toBe('table')
    );

    // 3. Unmount only the dataQuality wrapper -> the table banner must remain.
    unmountDataQuality();

    expect(useLimitStore.getState().bannerDetails).not.toBeNull();
    expect(useLimitStore.getState().bannerDetails?.resource).toBe('table');

    // 4. Cleanup the table wrapper -> banner retracted (it owns the banner).
    unmountTable();

    expect(useLimitStore.getState().bannerDetails).toBeNull();
  });

  it('retracts its own banner when the owning wrapper unmounts', async () => {
    mockGetLimitByResource.mockResolvedValue(
      getLimitResponse(3, true, 'table')
    );

    const { unmount } = render(
      <LimitWrapper resource="table">
        <button type="button">Table</button>
      </LimitWrapper>
    );

    await waitFor(() =>
      expect(useLimitStore.getState().bannerDetails?.resource).toBe('table')
    );

    unmount();

    expect(useLimitStore.getState().bannerDetails).toBeNull();
  });

  it('does not retract a resource-less banner on any wrapper unmount', async () => {
    mockGetLimitByResource.mockResolvedValue(
      getLimitResponse(1, false, 'dataQuality')
    );

    // Stage a banner raised without a resource tag (e.g. by an external
    // caller of setBannerDetails). A wrapper unmount must not retract it,
    // matching the close-button-only contract in the BannerDetails doc comment.
    useLimitStore.setState({
      bannerDetails: {
        header: 'server.entity-limit-reached',
        subheader: 'manual',
        type: 'warning',
      },
    });

    const { unmount } = render(
      <LimitWrapper resource="dataQuality">
        <button type="button">Data Quality</button>
      </LimitWrapper>
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Data Quality' })).toBeEnabled()
    );

    unmount();

    // The resource-less banner survives because undefined !== 'dataQuality'.
    expect(useLimitStore.getState().bannerDetails).not.toBeNull();
    expect(useLimitStore.getState().bannerDetails?.resource).toBeUndefined();
  });
});
