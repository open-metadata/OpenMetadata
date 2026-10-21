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
  Effect,
  Operation,
  Rule,
} from '../../../../../../generated/api/policies/createPolicy';
import AccessControlRulesTable from './AccessControlRulesTable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../../../common/RichTextEditor/RichTextEditorPreviewerV1',
  () =>
    ({ markdown }: { markdown: string }) =>
      <span data-testid="rule-description">{markdown}</span>
);

const ALLOW_RULE: Rule = {
  name: 'ViewTables',
  resources: ['table', 'topic'],
  operations: [Operation.ViewAll, Operation.ViewBasic],
  effect: Effect.Allow,
  description: 'Lets everyone view tables',
  condition: "isOwner() && matchAnyTag('PII.Sensitive')",
};

const DENY_RULE: Rule = {
  name: 'DenyDelete',
  resources: ['all'],
  operations: [Operation.Delete],
  effect: Effect.Deny,
};

const onEdit = jest.fn();
const onDelete = jest.fn();

const renderTable = (
  props: Partial<React.ComponentProps<typeof AccessControlRulesTable>> = {}
) =>
  render(
    <AccessControlRulesTable
      canEdit
      isDisabled={false}
      rules={[ALLOW_RULE, DENY_RULE]}
      onDelete={onDelete}
      onEdit={onEdit}
      {...props}
    />
  );

describe('AccessControlRulesTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders one row per rule with its resources, operations, effect and condition', () => {
    renderTable();

    const allowRow = screen.getByTestId('rule-ViewTables');

    expect(allowRow).toHaveTextContent('ViewTables');
    expect(allowRow).toHaveTextContent('table, topic');
    expect(allowRow).toHaveTextContent('ViewAll, ViewBasic');
    expect(allowRow).toHaveTextContent(Effect.Allow);
    expect(allowRow).toHaveTextContent(
      "isOwner() && matchAnyTag('PII.Sensitive')"
    );
    expect(allowRow).toHaveTextContent('Lets everyone view tables');
    expect(screen.getByTestId('rule-DenyDelete')).toHaveTextContent(
      Effect.Deny
    );
  });

  it('shows a placeholder for a rule without a condition or description', () => {
    renderTable({ rules: [DENY_RULE] });

    const row = screen.getByTestId('rule-DenyDelete');

    // Condition and description cells both fall back to the dash.
    expect(row.textContent?.match(/--/g)).toHaveLength(2);
  });

  it('hands the clicked rule to onEdit and its name to onDelete', () => {
    renderTable();

    fireEvent.click(screen.getByTestId('edit-rule-ViewTables'));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining(ALLOW_RULE));

    fireEvent.click(screen.getByTestId('delete-rule-DenyDelete'));

    expect(onDelete).toHaveBeenCalledWith('DenyDelete');
  });

  it('disables edit and delete without edit permission', () => {
    renderTable({ canEdit: false });

    expect(screen.getByTestId('edit-rule-ViewTables')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByTestId('delete-rule-ViewTables')).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    fireEvent.click(screen.getByTestId('edit-rule-ViewTables'));

    expect(onEdit).not.toHaveBeenCalled();
  });

  it('disables edit and delete while a save is in flight', () => {
    renderTable({ isDisabled: true });

    expect(screen.getByTestId('edit-rule-DenyDelete')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    expect(screen.getByTestId('delete-rule-DenyDelete')).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('shows the empty state when the policy has no rules', () => {
    renderTable({ rules: [] });

    expect(screen.getByText('label.no-entity-found')).toBeInTheDocument();
    expect(screen.queryByTestId('rule-ViewTables')).not.toBeInTheDocument();
  });
});
