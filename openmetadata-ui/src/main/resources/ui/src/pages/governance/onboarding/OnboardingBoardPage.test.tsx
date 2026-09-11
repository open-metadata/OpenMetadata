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
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingStage } from '../../../generated/governance/onboarding/onboardingProgress';
import { listOnboarding } from '../../../rest/governance/onboarding/Onboarding.api';
import OnboardingBoardPage from './OnboardingBoardPage';

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  listOnboarding: jest.fn(),
}));
jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

const list = listOnboarding as jest.MockedFunction<typeof listOnboarding>;
const scanCursor = '00000000-0000-0000-0000-000000001000';
const scanMessage = 'message.onboarding-board-scan-incomplete';
const asset = (id: string) => ({
  entity: { id, type: 'metric', name: id, fullyQualifiedName: id },
  stage: OnboardingStage.Draft,
  steps: [],
  blockingSteps: [],
  canAdvance: true,
});
const mountBoard = async (
  url = '/onboarding?entityType=metric&stage=Draft'
) => {
  window.history.replaceState({}, '', url);
  await act(async () => {
    render(
      <BrowserRouter>
        <OnboardingBoardPage />
      </BrowserRouter>
    );
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  list.mockReset();
  jest.useRealTimers();
});

it.each([0, 2, 25])(
  'continues a bounded scan containing %i matches and can return to it',
  async (count) => {
    const user = userEvent.setup();
    const data = Array.from({ length: count }, (_, index) =>
      asset(`asset-${index}`)
    );
    list.mockImplementation(async ({ after }) =>
      after
        ? { data: [asset('remaining-asset')] }
        : { data, after: scanCursor, scanLimitReached: true }
    );
    await mountBoard();

    expect(await screen.findByText(scanMessage)).toBeInTheDocument();
    expect(screen.queryByText('message.onboarding-board-empty')).toBeNull();
    expect(screen.queryAllByRole('link')).toHaveLength(count);

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'label.next' }));
    });

    expect(
      await screen.findByRole('link', { name: 'remaining-asset' })
    ).toBeVisible();
    expect(new URLSearchParams(window.location.search).get('after')).toBe(
      scanCursor
    );
    expect(screen.queryByText(scanMessage)).toBeNull();
    expect(screen.getByRole('button', { name: 'label.next' })).toBeDisabled();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'label.previous' }));
    });

    expect(await screen.findByText(scanMessage)).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).has('after')).toBe(
      false
    );
    expect(screen.queryByRole('link', { name: 'remaining-asset' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'label.previous' })
    ).toBeDisabled();
  }
);

it('retries a failed continuation at the same cursor without stale scan results', async () => {
  const user = userEvent.setup();
  list.mockResolvedValueOnce({
    data: [asset('first-asset')],
    after: scanCursor,
    scanLimitReached: true,
  });
  list.mockRejectedValueOnce(new Error('Board unavailable'));
  list.mockResolvedValueOnce({ data: [asset('remaining-asset')] });
  await mountBoard();

  await screen.findByText(scanMessage);
  await act(async () => {
    await user.click(screen.getByRole('button', { name: 'label.next' }));
  });

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'message.onboarding-board-load-error'
  );
  expect(screen.queryByText(scanMessage)).toBeNull();
  expect(screen.queryByRole('link', { name: 'first-asset' })).toBeNull();
  expect(screen.getByRole('button', { name: 'label.next' })).toBeDisabled();
  expect(new URLSearchParams(window.location.search).get('after')).toBe(
    scanCursor
  );

  await act(async () => {
    await user.click(screen.getByRole('button', { name: 'label.refresh' }));
  });

  expect(
    await screen.findByRole('link', { name: 'remaining-asset' })
  ).toBeVisible();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(new URLSearchParams(window.location.search).get('after')).toBe(
    scanCursor
  );
});

it('clears the continuation and its history when the filters change', async () => {
  const user = userEvent.setup();
  list.mockResolvedValueOnce({
    data: [],
    after: scanCursor,
    scanLimitReached: true,
  });
  list.mockResolvedValueOnce({ data: [] });
  await mountBoard(
    `/onboarding?entityType=metric&stage=Draft&after=${scanCursor}&previous=`
  );

  await screen.findByText(scanMessage);
  await act(async () => {
    await user.click(screen.getByRole('button', { name: /label.stage/ }));
  });
  await act(async () => {
    await user.click(screen.getByRole('option', { name: 'label.approved' }));
  });

  expect(
    await screen.findByText('message.onboarding-board-empty')
  ).toBeInTheDocument();

  const search = new URLSearchParams(window.location.search);

  expect(search.get('stage')).toBe('Approved');
  expect(search.has('after')).toBe(false);
  expect(search.has('previous')).toBe(false);
  expect(screen.queryByText(scanMessage)).toBeNull();
  expect(screen.getByRole('button', { name: 'label.next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'label.previous' })).toBeDisabled();
});
