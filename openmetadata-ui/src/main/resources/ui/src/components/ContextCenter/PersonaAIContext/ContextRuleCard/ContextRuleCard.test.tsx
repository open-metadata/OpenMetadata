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
import { EntityType } from '../../../../enums/entity.enum';
import { ContextSection } from '../../../../generated/type/personaContextDefinition';
import { ContextRuleCard } from './ContextRuleCard.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ContextRuleCard', () => {
  const rule = {
    description: 'Current description',
    entityType: EntityType.TABLE,
    name: 'Current name',
  };
  const defaultProps = {
    canEdit: true,
    onDelete: jest.fn(),
    onEdit: jest.fn(),
    rule,
  };

  it('keeps the original name, actions and description visibility by default', () => {
    render(<ContextRuleCard {...defaultProps} />);

    expect(screen.getByText(rule.name)).toBeInTheDocument();
    expect(screen.queryByText(rule.description)).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-context-rule')).toBeInTheDocument();
    expect(screen.getByTestId('delete-context-rule')).toBeInTheDocument();
  });

  it('shows inherited rules as read-only even when editing is allowed', () => {
    render(
      <ContextRuleCard
        {...defaultProps}
        inherited
        renderActions={() => 'Custom menu'}
      />
    );

    expect(screen.getByText('label.inherited')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-context-rule')).not.toBeInTheDocument();
    expect(screen.queryByTestId('delete-context-rule')).not.toBeInTheDocument();
    expect(screen.queryByText('Custom menu')).not.toBeInTheDocument();
  });

  it('renders version values, including a removed description', () => {
    render(
      <ContextRuleCard
        {...defaultProps}
        renderVersionValue={(field, value) =>
          field === 'name' ? (
            <ins>{value}</ins>
          ) : (
            <del>Previous description</del>
          )
        }
        rule={{ ...rule, description: undefined }}
      />
    );

    expect(screen.getByText(rule.name).tagName).toBe('INS');
    expect(screen.getByText('Previous description').tagName).toBe('DEL');
  });

  it('renders the supplied change badge', () => {
    render(<ContextRuleCard {...defaultProps} changeBadge="Changed" />);

    expect(screen.getByText('Changed')).toBeInTheDocument();
  });

  it('passes the parsed query to a custom condition renderer', () => {
    render(
      <ContextRuleCard
        {...defaultProps}
        renderQuery={(query) =>
          query.kind === 'conditions'
            ? query.conditions.map((condition) => condition.value).join(', ')
            : undefined
        }
        rule={{ ...rule, queryFilter: '{"term":{"name":"orders"}}' }}
      />
    );

    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('uses the custom action presentation and preserves delete confirmation', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    render(
      <ContextRuleCard
        {...defaultProps}
        renderActions={({ onEdit, onDelete }) => (
          <>
            <button type="button" onClick={onEdit}>
              Edit rule
            </button>
            <button type="button" onClick={onDelete}>
              Remove rule
            </button>
          </>
        )}
        onDelete={onDelete}
        onEdit={onEdit}
      />
    );

    expect(screen.queryByTestId('edit-context-rule')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit rule' }));

    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Remove rule' }));

    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('confirm-button'));

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('marks a disabled scoped rule without claiming its search filter is applied', () => {
    render(
      <ContextRuleCard
        canEdit
        rule={{
          entityType: EntityType.TABLE,
          name: 'Disabled tables',
          enabled: false,
          filteredInSearch: true,
        }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getAllByText('label.disabled').length).toBeGreaterThan(0);
    expect(
      screen.queryByText('message.persona-context-scoped-rule-summary')
    ).not.toBeInTheDocument();
  });

  it('renders knowledge rules as fully rendered and hides edit actions', () => {
    render(
      <ContextRuleCard
        canEdit={false}
        rule={{
          alwaysInContext: true,
          entityType: EntityType.KNOWLEDGE_PAGE,
          fullyRendered: true,
          name: 'Analytics articles',
        }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('label.fully-rendered')).toBeInTheDocument();
    expect(screen.getByText('label.always-in-context')).toBeInTheDocument();
    expect(screen.queryByLabelText('label.edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('label.delete')).not.toBeInTheDocument();
  });

  it('renders selected asset sections and edit actions', () => {
    render(
      <ContextRuleCard
        canEdit
        matched={12}
        rule={{
          entityType: EntityType.TABLE,
          name: 'Semantic tables',
          sections: [ContextSection.Schema, ContextSection.Profile],
        }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('label.schema')).toBeInTheDocument();
    expect(screen.getByText('label.profile')).toBeInTheDocument();
    expect(screen.getByText('label.heavy')).toBeInTheDocument();
    expect(screen.getByLabelText('label.edit')).toBeInTheDocument();
    expect(screen.getByLabelText('label.delete')).toBeInTheDocument();
  });
});
