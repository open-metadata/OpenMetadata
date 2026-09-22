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

import { fireEvent, render, screen } from '@testing-library/react';
import {
  OnboardingCondition,
  Operator,
} from '../../../generated/entity/governance/onboardingPlaybook';
import { PlaybookConditionEditor } from './PlaybookConditionEditor';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const renderEditor = (condition?: OnboardingCondition) => {
  const onChange = jest.fn();
  render(<PlaybookConditionEditor condition={condition} onChange={onChange} />);

  return onChange;
};

const pick = async (testId: string, option: string) => {
  fireEvent.click(
    screen.getByTestId(testId).querySelector('button') as Element
  );
  fireEvent.click(await screen.findByRole('option', { name: option }));
};

describe('PlaybookConditionEditor', () => {
  it('shows no operator or value until a field is chosen', () => {
    renderEditor();

    expect(screen.queryByTestId('check-condition-operator')).toBeNull();
    expect(screen.queryByTestId('check-condition-value')).toBeNull();
  });

  it('gates the check on the chosen field, presence by default', async () => {
    const onChange = renderEditor();

    await pick('check-condition-field', 'tags');

    expect(onChange).toHaveBeenCalledWith({
      fieldPath: 'tags',
      operator: Operator.Present,
      value: undefined,
    });
  });

  it('clears the condition when the check applies to everything again', async () => {
    const onChange = renderEditor({
      fieldPath: 'tags',
      operator: Operator.Present,
    });

    await pick('check-condition-field', 'label.all-assets');

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('asks for a value once the operator needs one', () => {
    renderEditor({
      fieldPath: 'tags',
      operator: Operator.StartsWith,
      value: 'PII.',
    });

    expect(screen.getByTestId('check-condition-value')).toHaveValue('PII.');
  });

  it('drops a stale value when the operator stops taking one', async () => {
    const onChange = renderEditor({
      fieldPath: 'tags',
      operator: Operator.StartsWith,
      value: 'PII.',
    });

    await pick('check-condition-operator', 'label.operator-present');

    expect(onChange).toHaveBeenCalledWith({
      fieldPath: 'tags',
      operator: Operator.Present,
      value: undefined,
    });
  });

  it('explains that startsWith is how a whole classification is matched', () => {
    renderEditor({
      fieldPath: 'tags',
      operator: Operator.StartsWith,
      value: 'PII.',
    });

    expect(
      screen.getByText('message.starts-with-matches-a-classification')
    ).toBeVisible();
  });
});
