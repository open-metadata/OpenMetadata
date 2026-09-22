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

import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { OnboardingStepResult } from '../../../generated/governance/onboarding/onboardingProgress';
import {
  OnboardingAgeCell,
  OnboardingNextStepCell,
  OnboardingProgressCell,
  OnboardingStageBadge,
  OnboardingWaitingOnCell,
} from './OnboardingRowCells';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-US' },
  }),
}));

const DAY = 24 * 60 * 60 * 1000;
const step = (overrides: Partial<OnboardingStepResult> = {}) =>
  ({
    step: { id: 'expert', title: 'Data expert', type: 'responsibility' },
    required: true,
    state: 'Pending',
    ...overrides,
  } as OnboardingStepResult);

const withRouter = (node: React.ReactElement) =>
  render(<BrowserRouter>{node}</BrowserRouter>);

describe('OnboardingStageBadge', () => {
  it('names the stage the playbook gave it, not the key', () => {
    render(
      <OnboardingStageBadge
        stage="draft"
        stages={[{ key: 'draft', displayName: 'Working copy', order: 1 }]}
      />
    );

    expect(screen.getByText('Working copy')).toBeVisible();
  });

  it('falls back to the shared stage translation without a playbook', () => {
    render(<OnboardingStageBadge stage="inReview" />);

    expect(screen.getByText('label.in-review')).toBeVisible();
  });
});

describe('OnboardingAgeCell', () => {
  it('shows a dash for an asset with no recorded timestamp', () => {
    render(<OnboardingAgeCell testId="age" />);

    expect(screen.getByTestId('age')).toHaveTextContent('-');
  });

  it('states a late age in red so the row reads as something to chase', () => {
    render(
      <OnboardingAgeCell isLate testId="age" timestamp={Date.now() - 9 * DAY} />
    );

    expect(screen.getByTestId('age')).toHaveTextContent('9d');
    expect(screen.getByTestId('age')).toHaveClass('tw:text-error-primary');
  });
});

describe('OnboardingProgressCell', () => {
  it('counts the blocking checks that are done', () => {
    render(<OnboardingProgressCell complete={2} total={5} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '2'
    );
    expect(screen.getByText('message.steps-of-total')).toBeVisible();
  });

  it('shows a full bar rather than an empty one when nothing is asked for', () => {
    render(<OnboardingProgressCell complete={0} total={0} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '1'
    );
  });
});

describe('OnboardingWaitingOnCell', () => {
  it('links the open check to its task', () => {
    withRouter(
      <OnboardingWaitingOnCell
        step={step({
          taskId: 'task-9',
          assignees: [
            {
              id: 'u1',
              type: 'user',
              name: 'priya',
              displayName: 'Priya Raman',
            },
          ],
        })}
      />
    );

    expect(screen.getByText('Priya Raman')).toBeVisible();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/tasks/task-9');
  });

  it('says a check is unassigned rather than showing an empty name', () => {
    withRouter(<OnboardingWaitingOnCell step={step()} />);

    expect(screen.getByText('label.unassigned')).toBeVisible();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('shows a dash when nothing is open', () => {
    withRouter(<OnboardingWaitingOnCell />);

    expect(screen.getByText('-')).toBeVisible();
  });
});

describe('OnboardingNextStepCell', () => {
  it('invites the viewer into their own open check', () => {
    withRouter(
      <OnboardingNextStepCell mine={step()} to="/dataProduct/customer_360" />
    );

    expect(screen.getByTestId('continue-setup')).toHaveAttribute(
      'href',
      '/dataProduct/customer_360?check=expert'
    );
  });

  it('names whose desk it is on when the viewer has nothing to do', () => {
    withRouter(<OnboardingNextStepCell to="/x" waiting={step()} />);

    expect(screen.getByText('label.waiting-for-check')).toBeVisible();
    expect(screen.queryByTestId('continue-setup')).toBeNull();
  });

  it('shows a dash when nothing is outstanding at all', () => {
    withRouter(<OnboardingNextStepCell to="/x" />);

    expect(screen.getByText('-')).toBeVisible();
  });
});
