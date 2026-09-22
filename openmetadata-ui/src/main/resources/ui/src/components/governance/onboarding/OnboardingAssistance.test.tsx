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
import { Assistance } from '../../../generated/entity/governance/onboardingPlaybook';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import {
  CheckType,
  OnboardingStep,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { searchQuery } from '../../../rest/searchAPI';
import { OnboardingAssistance } from './OnboardingAssistance';

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

const step = {
  id: 'experts',
  type: CheckType.Responsibility,
  fieldPath: 'experts',
  assistance: Assistance.Autofill,
  guidance: 'Name the person who answers consumer questions.',
} as OnboardingStep;

const siblings = {
  hits: {
    hits: [
      { _source: { experts: [{ id: '1', name: 'ana', displayName: 'Ana' }] } },
      { _source: { experts: [{ id: '1', name: 'ana', displayName: 'Ana' }] } },
      { _source: { experts: [] } },
    ],
  },
};

beforeEach(() => jest.clearAllMocks());

it('offers the neighbours convention and copies it into the editor', async () => {
  (searchQuery as jest.Mock).mockResolvedValue(siblings);
  const onApply = jest.fn();
  render(
    <OnboardingAssistance
      domain="Marketing"
      entityType={TargetEntityType.DataProduct}
      fieldPath="experts"
      step={step}
      value={[]}
      onApply={onApply}
    />
  );

  expect(
    await screen.findByText('message.siblings-use-this-value')
  ).toBeInTheDocument();

  fireEvent.click(screen.getByTestId('onboarding-copy-setup'));

  expect(onApply).toHaveBeenCalledWith([
    { id: '1', name: 'ana', displayName: 'Ana' },
  ]);
});

it('stays out of the way once the field has an answer', async () => {
  (searchQuery as jest.Mock).mockResolvedValue(siblings);
  render(
    <OnboardingAssistance
      domain="Marketing"
      entityType={TargetEntityType.DataProduct}
      fieldPath="experts"
      step={step}
      value={[{ id: '2' }]}
      onApply={jest.fn()}
    />
  );

  await waitFor(() => expect(searchQuery).not.toHaveBeenCalled());

  expect(screen.queryByTestId('onboarding-assistance')).not.toBeInTheDocument();
});

it('shows the author guidance as an example when that is the assistance offered', () => {
  render(
    <OnboardingAssistance
      entityType={TargetEntityType.DataProduct}
      fieldPath="description"
      step={{ ...step, assistance: Assistance.Example }}
      value=""
      onApply={jest.fn()}
    />
  );

  expect(screen.getByTestId('onboarding-assistance')).toHaveTextContent(
    'Name the person who answers consumer questions.'
  );
});
