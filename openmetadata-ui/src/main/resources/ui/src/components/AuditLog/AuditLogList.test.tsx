/*
 *  Copyright 2025 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { ChangeEvent, EventType } from '../../generated/type/changeEvent';
import { AuditLogEntry } from '../../types/auditLogs.interface';
import {
  formatDate,
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import AuditLogList from './AuditLogList.component';

// Helper to create partial ChangeEvent mocks without strict type enforcement
const mockChangeEvent = (partial: Partial<ChangeEvent>): ChangeEvent =>
  partial as unknown as ChangeEvent;

jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest
    .fn()
    .mockImplementation(({ name, displayName }) => (
      <div data-testid="profile-picture">{displayName || name}</div>
    ))
);

jest.mock('@openmetadata/ui-core-components', () => {
  const actual = jest.requireActual('@openmetadata/ui-core-components');

  return {
    ...actual,
    EmptyPlaceholder: ({ title }: { title: string }) => (
      <div data-testid="empty-placeholder">{title}</div>
    ),
    Skeleton: Object.assign(
      ({ variant, className }: { variant?: string; className?: string }) => (
        <span
          className={`skeleton-mock ${className ?? ''} ${variant ?? ''}`}
          data-testid="skeleton"
        />
      ),
      {}
    ),
  };
});

jest.mock('../Database/SchemaEditor/SchemaEditor', () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => (
    <pre data-testid="schema-editor">{value}</pre>
  ),
}));

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AuditLogList', () => {
  const NOW = Date.now();

  const updateLog = (
    changeDescription: ChangeEvent['changeDescription'],
    overrides: Partial<AuditLogEntry> = {}
  ): AuditLogEntry => ({
    id: 1,
    eventTs: NOW,
    eventType: EventType.EntityUpdated,
    userName: 'admin',
    actorType: 'USER',
    entityType: 'table',
    entityFQN: 'sample_data.ecommerce_db.shopify.dim_customer',
    summary: 'Server summary that must not win over field changes',
    changeEvent: mockChangeEvent({
      eventType: EventType.EntityUpdated,
      entityType: 'table',
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [],
        fieldsDeleted: [],
        ...changeDescription,
      },
    }),
    ...overrides,
  });

  const mockLogs: AuditLogEntry[] = [
    {
      id: 1,
      changeEventId: 'event-1',
      eventTs: NOW - 60000,
      eventType: EventType.EntityCreated,
      userName: 'admin',
      entityType: 'glossary',
      entityFQN: 'AuditDemoGlossary',
      summary: 'Created glossary: AuditDemoGlossary',
    },
    updateLog(
      {
        fieldsAdded: [
          {
            name: 'tags',
            newValue: JSON.stringify([
              { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
            ]),
          },
        ],
      },
      { id: 2, userName: 'test_user', eventTs: NOW - 120000 }
    ),
  ];

  const renderLogs = (logs: AuditLogEntry[]) =>
    renderWithRouter(<AuditLogList isLoading={false} logs={logs} />);

  it('should render the skeleton while loading, without the loaded list', () => {
    renderWithRouter(<AuditLogList isLoading logs={[]} />);

    expect(screen.getByTestId('audit-log-list-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    // Playwright treats `audit-log-list` as "loaded", so loading must not render it.
    expect(screen.queryByTestId('audit-log-list')).not.toBeInTheDocument();
  });

  it('should render the empty state when there are no logs', () => {
    renderLogs([]);

    expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
  });

  it('should render one card per log with avatar and user link', () => {
    renderLogs(mockLogs);

    expect(screen.getAllByTestId('audit-log-list-item')).toHaveLength(2);
    expect(screen.getAllByTestId('profile-picture')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'admin' })).toHaveAttribute(
      'href',
      '/users/admin'
    );
    expect(screen.getByRole('link', { name: 'test_user' })).toHaveAttribute(
      'href',
      '/users/test_user'
    );
  });

  it('should label each event type with a short badge', () => {
    renderLogs(mockLogs);

    const eventTypes = screen.getAllByTestId('event-type');

    expect(eventTypes[0]).toHaveTextContent('label.created');
    expect(eventTypes[1]).toHaveTextContent('label.updated');
  });

  it('should fall back to a humanized label for unknown event types', () => {
    renderLogs([
      { id: 1, eventTs: NOW, eventType: 'lineageAdded', userName: 'admin' },
    ]);

    expect(screen.getByTestId('event-type')).toHaveTextContent('Lineage Added');
  });

  it('should group logs under a header per day, marking today', () => {
    const lastWeek = NOW - 7 * 24 * 60 * 60 * 1000;
    renderLogs([...mockLogs, { ...mockLogs[0], id: 3, eventTs: lastWeek }]);

    const headers = screen.getAllByTestId('audit-log-day-header');

    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent(`label.today · ${formatDate(NOW)}`);
    expect(headers[1]).toHaveTextContent(formatDate(lastWeek));
    expect(headers[1]).not.toHaveTextContent('label.today');
  });

  it('should show the entity type and the exact date-time with the relative time', () => {
    renderLogs(mockLogs);

    expect(screen.getAllByTestId('entity-type-badge')[0]).toHaveTextContent(
      'Glossary'
    );
    expect(screen.getAllByTestId('timestamp')[0]).toHaveTextContent(
      `${formatDateTime(mockLogs[0].eventTs)} · ${getRelativeTime(
        mockLogs[0].eventTs
      )}`
    );
  });

  it('should show the bot badge and the impersonating user', () => {
    renderLogs([
      updateLog(
        { fieldsAdded: [{ name: 'description', newValue: 'x' }] },
        { userName: 'ingestion-bot', actorType: 'BOT', impersonatedBy: 'jane' }
      ),
    ]);

    expect(screen.getByTestId('bot-badge')).toHaveTextContent('label.bot');
    expect(screen.getByTestId('impersonated-by')).toHaveTextContent('jane');
    expect(screen.getByRole('link', { name: 'jane' })).toHaveAttribute(
      'href',
      '/users/jane'
    );
  });

  it('should show the summary for events without field changes', () => {
    renderLogs([mockLogs[0]]);

    expect(screen.getByTestId('description-content')).toHaveTextContent(
      'Created glossary: AuditDemoGlossary'
    );
    expect(screen.queryByTestId('change-row')).not.toBeInTheDocument();
    // The entity name is its FQN, so the FQN is not repeated beside it.
    expect(screen.getByTestId('affected-entity')).toHaveTextContent(
      'AuditDemoGlossary'
    );
    expect(screen.queryByTestId('affected-entity-fqn')).not.toBeInTheDocument();
  });

  it('should show the affected asset with its link and FQN, and the column path', () => {
    renderLogs([
      updateLog({
        fieldsAdded: [
          {
            name: 'columns.customer_id.tags',
            newValue: JSON.stringify([
              { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
            ]),
          },
        ],
      }),
    ]);

    expect(screen.getByRole('link', { name: 'dim_customer' })).toHaveAttribute(
      'href',
      '/table/sample_data.ecommerce_db.shopify.dim_customer'
    );
    expect(screen.getByTestId('affected-entity-fqn')).toHaveTextContent(
      '(sample_data.ecommerce_db.shopify.dim_customer)'
    );
    expect(screen.getByTestId('change-action')).toHaveTextContent(
      'label.added'
    );
    expect(screen.getByTestId('change-field-path')).toHaveTextContent(
      'Columns › customer_id › Tags'
    );
    expect(
      screen.getByRole('link', { name: 'PII › Sensitive' })
    ).toHaveAttribute('href', '/tags/PII.Sensitive');
    expect(screen.getByTestId('description-content')).not.toHaveTextContent(
      'Server summary'
    );
  });

  it('should link glossary terms, tiers and entity references to their pages', () => {
    renderLogs([
      updateLog({
        fieldsAdded: [
          {
            name: 'tags',
            newValue: JSON.stringify([
              { tagFQN: 'Tier.Tier1', name: 'Tier1' },
              {
                tagFQN: 'Business.Revenue',
                name: 'Revenue',
                source: 'Glossary',
              },
            ]),
          },
          {
            name: 'dataProducts',
            newValue: JSON.stringify([
              {
                type: 'dataProduct',
                name: 'sales-dp',
                fullyQualifiedName: 'sales-dp',
                displayName: 'Sales',
              },
            ]),
          },
          {
            name: 'domains',
            newValue: JSON.stringify([
              {
                type: 'domain',
                name: 'Engineering',
                fullyQualifiedName: 'Engineering',
              },
            ]),
          },
        ],
      }),
    ]);

    expect(screen.getByRole('link', { name: 'Tier1' })).toHaveAttribute(
      'href',
      '/tags/Tier.Tier1'
    );
    expect(
      screen.getByRole('link', { name: 'Business › Revenue' })
    ).toHaveAttribute('href', '/glossary/Business.Revenue');
    expect(screen.getByRole('link', { name: /Sales/ })).toHaveAttribute(
      'href',
      '/dataProduct/sales-dp'
    );
    expect(screen.getByRole('link', { name: /Engineering/ })).toHaveAttribute(
      'href',
      '/domain/Engineering'
    );
  });

  it('should show added and removed owners as linked chips with their kind', () => {
    renderLogs([
      updateLog({
        fieldsAdded: [
          {
            name: 'owners',
            newValue: JSON.stringify([
              { type: 'user', name: 'admin', fullyQualifiedName: 'admin' },
            ]),
          },
        ],
        fieldsDeleted: [
          {
            name: 'owners',
            oldValue: JSON.stringify([
              {
                type: 'team',
                name: 'Engineering',
                fullyQualifiedName: 'Engineering',
                displayName: 'Engineering Team',
              },
            ]),
          },
        ],
      }),
    ]);

    const actions = screen.getAllByTestId('change-action');

    expect(actions[0]).toHaveTextContent('label.added');
    expect(actions[1]).toHaveTextContent('label.removed');

    const [addedOwner, removedOwner] = screen.getAllByTestId('change-ref');

    expect(addedOwner).toHaveTextContent('adminUser');
    expect(addedOwner).toHaveAttribute('href', '/users/admin');
    expect(removedOwner).toHaveTextContent('Engineering TeamTeam');
    expect(removedOwner).toHaveAttribute(
      'href',
      '/settings/members/teams/Engineering'
    );
    expect(removedOwner).toHaveClass('tw:line-through');
  });

  it('should show an updated value as struck-through before and highlighted after', () => {
    renderLogs([
      updateLog({
        fieldsUpdated: [
          {
            name: 'columns.customer_id.description',
            oldValue: '<p>The ID of the customer.</p>',
            newValue: 'Unique customer identifier.',
          },
        ],
      }),
    ]);

    expect(screen.getByTestId('change-field-path')).toHaveTextContent(
      'Columns › customer_id › Description'
    );
    expect(screen.getByText('The ID of the customer.').tagName).toBe('DEL');
    expect(screen.getByText('Unique customer identifier.').tagName).toBe('INS');
    expect(screen.getByText('label.before')).toBeInTheDocument();
    expect(screen.getByText('label.after')).toBeInTheDocument();
  });

  it('should keep false as a real new value and unquote quoted column names', () => {
    renderLogs([
      updateLog({
        fieldsUpdated: [
          { name: 'disabled', oldValue: true, newValue: false },
          {
            name: 'columns."order.id".dataType',
            oldValue: 'INT',
            newValue: 'BIGINT',
          },
        ],
      }),
    ]);

    const [disabledRow, dataTypeRow] = screen.getAllByTestId('change-row');

    expect(disabledRow).toHaveTextContent('Disabled');
    expect(screen.getByText('true').tagName).toBe('DEL');
    expect(screen.getByText('false').tagName).toBe('INS');
    expect(dataTypeRow).toHaveTextContent('Columns › order.id › Data Type');
  });

  it('should render a list of objects as a table with status pills and formatted times', () => {
    const resultTime = 1795564824021;
    renderLogs([
      updateLog({
        fieldsUpdated: [
          {
            name: 'testCaseResultSummary',
            newValue: JSON.stringify([
              {
                status: 'Aborted',
                timestamp: resultTime,
                testCaseName: 'orders_row_count',
              },
            ]),
          },
        ],
      }),
    ]);

    const table = screen.getByTestId('change-table');

    expect(
      screen.getAllByRole('columnheader').map((th) => th.textContent)
    ).toEqual(['Status', 'Timestamp', 'Test Case Name']);
    expect(table).toHaveTextContent('Aborted');
    expect(table).toHaveTextContent(formatDateTime(resultTime));
    expect(table).toHaveTextContent('orders_row_count');
  });

  it('should cap table rows and say how many are hidden', () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      name: `row-${index}`,
    }));
    renderLogs([
      updateLog({
        fieldsAdded: [{ name: 'results', newValue: JSON.stringify(rows) }],
      }),
    ]);

    expect(screen.getAllByRole('row')).toHaveLength(6);
    expect(screen.getByText('label.plus-count-more')).toBeInTheDocument();
  });

  it('should render an object as key-value rows', () => {
    renderLogs([
      updateLog({
        fieldsUpdated: [
          {
            name: 'pipelineStatus',
            newValue: JSON.stringify({
              runId: 'b7f39045-3277-417e-98e8-dbac25cf4544',
              config: {},
              pipelineState: 'success',
            }),
          },
        ],
      }),
    ]);

    const keyValue = screen.getByTestId('change-key-value');

    expect(keyValue).toHaveTextContent('Run Id');
    expect(
      screen.getByText('b7f39045-3277-417e-98e8-dbac25cf4544')
    ).toHaveClass('tw:font-mono');
    expect(keyValue).toHaveTextContent('Config--');
    expect(keyValue).toHaveTextContent('Pipeline Statesuccess');
  });

  it('should fall back to the summary when the only change is the deleted flag', () => {
    renderLogs([
      updateLog(
        {
          fieldsUpdated: [{ name: 'deleted', oldValue: false, newValue: true }],
        },
        {
          eventType: EventType.EntitySoftDeleted,
          summary: 'Soft deleted table: svc.db.schema.orders',
        }
      ),
    ]);

    expect(screen.getByTestId('event-type')).toHaveTextContent(
      'label.soft-deleted'
    );
    expect(screen.getByTestId('description-content')).toHaveTextContent(
      'Soft deleted table: svc.db.schema.orders'
    );
    expect(screen.queryByTestId('change-row')).not.toBeInTheDocument();
  });

  it('should not repeat the actor as the affected entity on login events', () => {
    renderLogs([
      {
        id: 1,
        eventTs: NOW,
        eventType: EventType.UserLogin,
        userName: 'admin',
        entityType: 'user',
        entityFQN: 'admin',
        summary: 'User logged in',
      },
    ]);

    expect(screen.getByTestId('event-type')).toHaveTextContent(
      'label.logged-in'
    );
    expect(screen.getByText('User logged in')).toBeInTheDocument();
    expect(screen.queryByTestId('affected-entity')).not.toBeInTheDocument();
  });

  it('should link a user entity to its profile', () => {
    renderLogs([
      updateLog(
        { fieldsAdded: [{ name: 'displayName', newValue: 'John Doe' }] },
        {
          entityType: 'user',
          entityFQN: 'john_doe',
          changeEvent: mockChangeEvent({
            entityType: 'user',
            entity: {
              id: 'u-1',
              name: 'john_doe',
              displayName: 'John Doe',
              fullyQualifiedName: 'john_doe',
            },
            changeDescription: {
              fieldsAdded: [{ name: 'displayName', newValue: 'John Doe' }],
              fieldsUpdated: [],
              fieldsDeleted: [],
            },
          }),
        }
      ),
    ]);

    expect(screen.getByTestId('affected-entity')).toContainElement(
      screen.getAllByRole('link', { name: 'John Doe' })[0]
    );
    expect(
      screen.getAllByRole('link', { name: 'John Doe' })[0]
    ).toHaveAttribute('href', '/users/john_doe');
  });

  it('should display System for logs without userName', () => {
    renderLogs([
      {
        id: 1,
        eventTs: NOW,
        eventType: EventType.EntityUpdated,
        entityType: 'table',
      },
    ]);

    expect(screen.getByTestId('profile-picture')).toHaveTextContent(
      'label.system'
    );
  });

  it('should open the raw event JSON from View JSON', async () => {
    const rawEventJson = JSON.stringify({
      id: 'evt-1',
      eventType: 'entityUpdated',
    });
    renderLogs([
      updateLog(
        { fieldsAdded: [{ name: 'description', newValue: 'x' }] },
        { rawEventJson }
      ),
    ]);

    fireEvent.click(screen.getByTestId('view-json-button'));

    const editor = await screen.findByTestId('schema-editor');

    expect(editor).toHaveTextContent('"id": "evt-1"');
    expect(editor).toHaveTextContent('"eventType": "entityUpdated"');
  });
});
