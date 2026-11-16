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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../context/LimitsProvider/useLimitsStore';
import LimitWrapper from './LimitWrapper';

jest.mock('../context/LimitsProvider/useLimitsStore');

const mockUseLimitStore = useLimitStore as jest.MockedFunction<
  typeof useLimitStore
>;
const mockGetResourceLimit = jest.fn();
const mockSetBannerDetails = jest.fn();

const UntitledButton = ({
  children,
  isDisabled,
  onPress,
}: {
  children: string;
  isDisabled?: boolean;
  onPress?: () => void;
}) => (
  <button disabled={isDisabled} type="button" onClick={onPress}>
    {children}
  </button>
);

const metricLimit = {
  name: 'metric',
  limitReached: false,
  currentCount: 1,
  configuredLimit: {
    name: 'metric',
    limits: {
      softLimit: 2,
      hardLimit: 3,
    },
  },
};

const setLimitStore = (
  overrides: Partial<ReturnType<typeof useLimitStore>> = {}
) => {
  mockUseLimitStore.mockReturnValue({
    config: {
      enable: true,
      limits: {
        config: {
          version: 'test',
          plan: 'test',
          installationType: 'test',
          deployment: 'test',
          companyName: 'test',
          domain: 'test',
          instances: 1,
          featureLimits: [],
        },
      },
    },
    resourceLimit: { metric: metricLimit },
    bannerDetails: null,
    getResourceLimit: mockGetResourceLimit,
    setConfig: jest.fn(),
    setResourceLimit: jest.fn(),
    setBannerDetails: mockSetBannerDetails,
    ...overrides,
  });
};

describe('LimitWrapper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
      i18n: { language: 'en-US', dir: jest.fn().mockReturnValue('ltr') },
    });
    mockGetResourceLimit.mockResolvedValue(metricLimit);
    setLimitStore();
  });

  it('returns the child without a limit request when limits are disabled', () => {
    setLimitStore({ config: null });

    render(
      <LimitWrapper resource="metric">
        <button type="button">Create</button>
      </LimitWrapper>
    );

    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled();
    expect(mockGetResourceLimit).not.toHaveBeenCalled();
  });

  it('renders an accessible Untitled skeleton while the limit loads', () => {
    mockGetResourceLimit.mockReturnValue(new Promise(() => undefined));

    render(
      <LimitWrapper resource="metric">
        <button type="button">Create</button>
      </LimitWrapper>
    );

    expect(
      screen.getByRole('status', { name: 'label.loading' })
    ).toBeInTheDocument();
  });

  it('disables the child and explains a reached limit', async () => {
    const onClick = jest.fn();
    const reachedLimit = {
      ...metricLimit,
      currentCount: 3,
      limitReached: true,
    };
    setLimitStore({ resourceLimit: { metric: reachedLimit } });
    mockGetResourceLimit.mockResolvedValue(reachedLimit);

    render(
      <LimitWrapper resource="metric">
        <button type="button" onClick={onClick}>
          Create
        </button>
      </LimitWrapper>
    );

    const button = await screen.findByRole('button', { name: 'Create' });

    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onClick).not.toHaveBeenCalled();

    expect(
      screen.getByRole('button', {
        name: 'server.entity-limit-reached (3/3)',
      })
    ).toBeEnabled();
  });

  it('blocks Untitled button press handlers when the limit is reached', async () => {
    const onPress = jest.fn();
    const reachedLimit = {
      ...metricLimit,
      currentCount: 3,
      limitReached: true,
    };
    setLimitStore({ resourceLimit: { metric: reachedLimit } });
    mockGetResourceLimit.mockResolvedValue(reachedLimit);

    render(
      <LimitWrapper resource="metric">
        <UntitledButton onPress={onPress}>Create metric</UntitledButton>
      </LimitWrapper>
    );

    const button = await screen.findByRole('button', {
      name: 'Create metric',
    });

    expect(button).toBeDisabled();

    fireEvent.click(button);

    expect(onPress).not.toHaveBeenCalled();
  });

  it('keeps the child enabled below the limit', async () => {
    render(
      <LimitWrapper resource="metric">
        <button type="button">Create</button>
      </LimitWrapper>
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    );
  });

  it('uses a localized label for shared non-Metric consumers', async () => {
    const reachedLimit = {
      ...metricLimit,
      name: 'knowledgeCenter',
      currentCount: 3,
      limitReached: true,
      configuredLimit: {
        ...metricLimit.configuredLimit,
        name: 'knowledgeCenter',
      },
    };
    setLimitStore({ resourceLimit: { knowledgeCenter: reachedLimit } });
    mockGetResourceLimit.mockResolvedValue(reachedLimit);
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, options?: { entity?: string }) =>
        options?.entity ? `${key}:${options.entity}` : `fa:${key}`,
      i18n: { language: 'pr-PR', dir: jest.fn().mockReturnValue('rtl') },
    });

    render(
      <LimitWrapper resource="knowledgeCenter">
        <button type="button">Create</button>
      </LimitWrapper>
    );

    expect(
      await screen.findByRole('button', {
        name: 'server.entity-limit-reached:fa:label.context-center (3/3)',
      })
    ).toBeEnabled();
  });

  it('recovers from a failed limit request and clears the banner on cleanup', async () => {
    mockGetResourceLimit.mockRejectedValue(new Error('limit service failed'));
    const { unmount } = render(
      <LimitWrapper resource="metric">
        <button type="button">Create</button>
      </LimitWrapper>
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()
    );

    unmount();

    expect(mockSetBannerDetails).toHaveBeenCalledWith(null);
  });
});
