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
import { PasswordRuleId } from './PasswordStrength.utils';
import PasswordStrengthMeter from './PasswordStrengthMeter';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const ruleStatus = (id: PasswordRuleId) =>
  screen.getByTestId(`password-rule-${id}`).closest('li')?.textContent;

describe('PasswordStrengthMeter', () => {
  it('renders every rule as unmet with a weak, empty bar for an empty password', () => {
    render(<PasswordStrengthMeter password="" />);

    expect(screen.getByTestId('password-strength-label')).toHaveTextContent(
      'label.weak'
    );
    expect(screen.getByTestId('password-rule-list').children).toHaveLength(4);

    Object.values(PasswordRuleId).forEach((id) =>
      expect(ruleStatus(id)).toContain('label.requirement-not-met')
    );
    const bar = screen
      .getByTestId('password-strength-meter')
      .querySelector('[style]');

    expect(bar).toHaveStyle({ width: '0%' });
  });

  it('marks only the satisfied rules and reads medium at partial strength', () => {
    render(<PasswordStrengthMeter password="abcdefgh1" />);

    expect(screen.getByTestId('password-strength-label')).toHaveTextContent(
      'label.medium'
    );
    expect(ruleStatus(PasswordRuleId.Length)).toContain(
      'label.requirement-met'
    );
    expect(ruleStatus(PasswordRuleId.Number)).toContain(
      'label.requirement-met'
    );
    expect(ruleStatus(PasswordRuleId.MixedCase)).toContain(
      'label.requirement-not-met'
    );
    expect(ruleStatus(PasswordRuleId.Symbol)).toContain(
      'label.requirement-not-met'
    );
  });

  it('fills the bar and reads strong once every rule passes', () => {
    render(<PasswordStrengthMeter password="Abcdefg@1" />);

    expect(screen.getByTestId('password-strength-label')).toHaveTextContent(
      'label.strong'
    );

    Object.values(PasswordRuleId).forEach((id) =>
      expect(ruleStatus(id)).toContain('label.requirement-met')
    );
    const bar = screen
      .getByTestId('password-strength-meter')
      .querySelector('[style]');

    expect(bar).toHaveStyle({ width: '100%' });
  });
});
