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
import { OnboardingProgress } from '../../../generated/governance/onboarding/onboardingProgress';
import {
  getOnboardingSummary,
  listOnboarding,
  nudgeOnboarding,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { getOnboardingPlaybooks } from '../../../rest/governance/onboarding/OnboardingPlaybook.api';
import OnboardingBoardPage from './OnboardingBoardPage';

jest.mock('../../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  getOnboardingSummary: jest.fn(),
  listOnboarding: jest.fn(),
  nudgeOnboarding: jest.fn(),
}));
jest.mock('../../../rest/governance/onboarding/OnboardingPlaybook.api', () => ({
  getOnboardingPlaybooks: jest.fn(),
}));
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
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
const summaryOf = getOnboardingSummary as jest.MockedFunction<
  typeof getOnboardingSummary
>;
const nudge = nudgeOnboarding as jest.MockedFunction<typeof nudgeOnboarding>;
const playbooksOf = getOnboardingPlaybooks as jest.MockedFunction<
  typeof getOnboardingPlaybooks
>;
const scanCursor = '00000000-0000-0000-0000-000000001000';
const scanMessage = 'message.onboarding-board-scan-incomplete';
const asset = (id: string) => ({
  entity: { id, type: 'metric', name: id, fullyQualifiedName: id },
  stage: 'draft',
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
  summaryOf.mockReset();
  nudge.mockReset();
  playbooksOf.mockReset();
  summaryOf.mockRejectedValue(new Error('no summary'));
  playbooksOf.mockResolvedValue({ data: [], paging: { total: 0 } });
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

  expect(search.get('stage')).toBe('approved');
  expect(search.has('after')).toBe(false);
  expect(search.has('previous')).toBe(false);
  expect(screen.queryByText(scanMessage)).toBeNull();
  expect(screen.getByRole('button', { name: 'label.next' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'label.previous' })).toBeDisabled();
});

const DAY = 24 * 60 * 60 * 1000;
const waitingRow = (): OnboardingProgress =>
  ({
    entity: {
      id: 'dp-1',
      type: 'dataProduct',
      name: 'customer_360',
      fullyQualifiedName: 'customer_360',
      displayName: 'Customer 360',
    },
    configurationId: 'pb-1',
    stage: 'draft',
    enteredAt: Date.now() - 2 * DAY,
    domains: [{ id: 'dom-1', type: 'domain', name: 'Marketing' }],
    steps: [
      {
        step: {
          id: 'description',
          title: 'Business description',
          type: 'attribute',
        },
        required: true,
        state: 'Complete',
      },
      {
        step: { id: 'expert', title: 'Data expert', type: 'responsibility' },
        required: true,
        state: 'Pending',
        taskId: 'task-9',
        assignees: [
          { id: 'u1', type: 'user', name: 'priya', displayName: 'Priya Raman' },
        ],
      },
    ],
    blockingSteps: [],
    canAdvance: false,
  } as unknown as OnboardingProgress);

const mountDataProductBoard = async () => {
  await mountBoard('/onboarding?entityType=dataProduct');
};

describe('the board as Data Management reads it', () => {
  it('names who a row is waiting on, for what, and how long it has waited', async () => {
    list.mockResolvedValue({ data: [waitingRow()] });
    await mountDataProductBoard();

    expect(await screen.findByText('Priya Raman')).toBeVisible();
    expect(screen.getByText('label.waiting-for-check')).toBeVisible();
    expect(screen.getByTestId('in-stage-dp-1')).toHaveTextContent('2d');
    expect(screen.getByText('message.steps-of-total')).toBeVisible();
  });

  it('shows the stat tiles with the numbers the server measured', async () => {
    list.mockResolvedValue({ data: [waitingRow()] });
    summaryOf.mockResolvedValue({
      entityType: 'dataProduct',
      reachedReviewInTime: { share: 75, deltaPoints: 25, thresholdDays: 7 },
      daysInEntryStage: {
        stage: 'draft',
        medianDays: 3,
        deltaDays: 2.5,
        sampleSize: 4,
        windowDays: 30,
      },
      followUps: { manual: 4, windowDays: 7 },
    });
    await mountDataProductBoard();

    expect(
      await screen.findByTestId('tile-reached-review-value')
    ).toHaveTextContent('75%');
    expect(screen.getByTestId('tile-reached-review-delta')).toHaveTextContent(
      'label.delta-points'
    );
    expect(screen.getByTestId('tile-median-days-value')).toHaveTextContent(
      '3.0'
    );
    expect(screen.getByTestId('tile-median-days-delta')).toHaveTextContent(
      '−2.5'
    );
    expect(screen.getByTestId('tile-follow-ups-value')).toHaveTextContent('4');
  });

  it('keeps the table when the tiles fail, and says there is no data yet', async () => {
    list.mockResolvedValue({ data: [waitingRow()] });
    summaryOf.mockRejectedValue(new Error('summary unavailable'));
    await mountDataProductBoard();

    expect(await screen.findByText('Customer 360')).toBeVisible();
    expect(screen.getByTestId('tile-reached-review-value')).toHaveTextContent(
      '-'
    );
    expect(screen.getAllByText('message.no-data-yet').length).toBe(3);
  });

  it('sends a reminder and remembers it was sent', async () => {
    const user = userEvent.setup();
    const row = waitingRow();
    list.mockResolvedValue({ data: [row] });
    nudge.mockResolvedValue({
      ...row,
      steps: [row.steps[0], { ...row.steps[1], lastReminderAt: Date.now() }],
    });
    await mountDataProductBoard();

    await act(async () => {
      await user.click(await screen.findByTestId('nudge-dp-1'));
    });

    expect(nudge).toHaveBeenCalledWith('dataProduct', 'dp-1', {
      stepId: 'expert',
    });
    expect(await screen.findByText('label.nudged')).toBeVisible();
    expect(screen.getByTestId('nudge-dp-1')).toBeDisabled();
  });

  it('will not offer a second reminder inside the server cooldown', async () => {
    const row = waitingRow();
    list.mockResolvedValue({
      data: [
        {
          ...row,
          steps: [
            row.steps[0],
            { ...row.steps[1], lastReminderAt: Date.now() - 60_000 },
          ],
        },
      ],
    });
    await mountDataProductBoard();

    expect(await screen.findByTestId('nudge-dp-1')).toBeDisabled();
    expect(screen.getByText('label.nudged')).toBeVisible();
  });

  it('offers the reminder again once the cooldown has passed', async () => {
    const row = waitingRow();
    list.mockResolvedValue({
      data: [
        {
          ...row,
          steps: [
            row.steps[0],
            { ...row.steps[1], lastReminderAt: Date.now() - 2 * DAY },
          ],
        },
      ],
    });
    await mountDataProductBoard();

    expect(await screen.findByTestId('nudge-dp-1')).toBeEnabled();
    expect(screen.getByText('label.nudge')).toBeVisible();
  });

  it('marks a row late once it has sat past the gate stall window', async () => {
    list.mockResolvedValue({
      data: [{ ...waitingRow(), enteredAt: Date.now() - 9 * DAY }],
    });
    await mountDataProductBoard();

    expect(await screen.findByTestId('in-stage-dp-1')).toHaveClass(
      'tw:text-error-primary'
    );
  });
});
