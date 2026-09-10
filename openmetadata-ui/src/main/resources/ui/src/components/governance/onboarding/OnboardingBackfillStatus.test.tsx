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
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import {
  getOnboardingBackfill,
  retryOnboardingBackfill,
} from '../../../rest/governance/onboarding/Onboarding.api';
import { OnboardingBackfillStatus } from './OnboardingBackfillStatus';
jest.mock('../../../rest/governance/onboarding/Onboarding.api', () => ({
  getOnboardingBackfill: jest.fn(),
  retryOnboardingBackfill: jest.fn(),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

it('offers immediate recovery from a failed backfill status load', async () => {
  (getOnboardingBackfill as jest.Mock)
    .mockRejectedValueOnce(new Error('Service unavailable'))
    .mockResolvedValue({ enrolled: 2, scanned: 3, complete: true });
  render(<OnboardingBackfillStatus entityType={TargetEntityType.Metric} />);
  fireEvent.click(await screen.findByRole('button', { name: 'label.retry' }));

  expect(await screen.findByText(/label.completed/)).toBeVisible();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('keeps failures visible after a failed retry and recovers on a later retry', async () => {
  (getOnboardingBackfill as jest.Mock).mockResolvedValue({
    enrolled: 0,
    scanned: 1,
    failures: [
      {
        entity: { id: 'metric', name: 'Orders' },
        message: 'Enrollment unavailable',
      },
    ],
  });
  (retryOnboardingBackfill as jest.Mock)
    .mockRejectedValueOnce(new Error('Service unavailable'))
    .mockResolvedValue({
      enrolled: 1,
      scanned: 1,
      complete: true,
      failures: [],
    });
  render(<OnboardingBackfillStatus entityType={TargetEntityType.Metric} />);
  fireEvent.click(await screen.findByRole('button', { name: 'label.retry' }));

  expect(
    await screen.findByText('Orders: Enrollment unavailable')
  ).toBeVisible();

  const retry = screen.getByRole('button', { name: 'label.retry' });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);

  expect(await screen.findByText(/label.completed/)).toBeVisible();
});
