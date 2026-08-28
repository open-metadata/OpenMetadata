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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ReactNode } from 'react';
import { EntityType } from '../../../../../enums/entity.enum';
import { ContextRule } from '../../../../../generated/type/personaContextDefinition';
import { ContextRuleEditor } from './ContextRuleEditor.component';

jest.mock('../../../../../rest/PersonaAPI', () => ({
  previewPersonaAIContextRule: jest.fn().mockResolvedValue({
    matchedCount: 0,
    sampleNames: [],
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../../../common/atoms/drawer/useFormDrawer', () => ({
  useFormDrawerWithHook: ({ form }: { form: ReactNode }) => ({
    closeDrawer: jest.fn(),
    formDrawer: <div>{form}</div>,
    isOpen: true,
    openDrawer: jest.fn(),
  }),
}));

jest.mock('./RuleQueryBuilderField.component', () => ({
  RuleQueryBuilderField: () => <div data-testid="rule-query-builder" />,
}));

describe('ContextRuleEditor', () => {
  const rule: ContextRule = {
    entityType: EntityType.TABLE,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Tables',
  };
  const defaultProps = {
    existingRuleNames: [],
    onClose: jest.fn(),
    onSubmit: jest.fn().mockResolvedValue(undefined),
    open: true,
    personaId: '11111111-1111-4111-8111-111111111111',
    rule,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('preserves edits when polling replaces a rule with the same id', () => {
    const { rerender } = render(<ContextRuleEditor {...defaultProps} />);
    const name = screen.getByTestId('context-rule-name');
    fireEvent.change(name, { target: { value: 'Typed locally' } });

    rerender(
      <ContextRuleEditor
        {...defaultProps}
        rule={{ ...rule, matchedCount: 12, name: 'Tables from poll' }}
      />
    );

    expect(name).toHaveValue('Typed locally');
  });

  it('forces knowledge rules to use full rendering', () => {
    render(
      <ContextRuleEditor
        {...defaultProps}
        rule={{
          entityType: EntityType.GLOSSARY_TERM,
          id: rule.id,
          name: 'Terms',
        }}
      />
    );

    const fullyRendered = within(
      screen.getByTestId('context-rule-fully-rendered')
    ).getByRole('switch');

    expect(fullyRendered).toBeChecked();
    expect(fullyRendered).toBeDisabled();
  });
});
