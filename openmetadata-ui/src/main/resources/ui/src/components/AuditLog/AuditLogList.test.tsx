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

import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChangeEvent, EventType } from '../../generated/type/changeEvent';
import { AuditLogEntry } from '../../types/auditLogs.interface';
import {
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

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AuditLogList', () => {
  const NOW = Date.now();
  const TABLE_FQN = 'sample_data.ecommerce_db.shopify.dim_customer';

  const updateLog = (
    changeDescription: Partial<NonNullable<ChangeEvent['changeDescription']>>,
    overrides: Partial<AuditLogEntry> = {}
  ): AuditLogEntry => ({
    id: 1,
    eventTs: NOW,
    eventType: EventType.EntityUpdated,
    userName: 'admin',
    actorType: 'USER',
    entityType: 'table',
    entityFQN: TABLE_FQN,
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

  const createdLog: AuditLogEntry = {
    id: 10,
    eventTs: NOW - 60000,
    eventType: EventType.EntityCreated,
    userName: 'admin',
    entityType: 'glossary',
    entityFQN: 'AuditDemoGlossary',
    summary: 'Created glossary: AuditDemoGlossary',
  };

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

  it('should render one row per log with avatar and user link', () => {
    renderLogs([createdLog, updateLog({}, { id: 2, userName: 'test_user' })]);

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

  it.each([
    [EventType.EntityCreated, 'Entity Created'],
    [EventType.EntityUpdated, 'Entity Updated'],
    [EventType.EntityFieldsChanged, 'Entity Fields Changed'],
    [EventType.EntitySoftDeleted, 'Entity Soft Deleted'],
    [EventType.EntityDeleted, 'Entity Deleted'],
    [EventType.EntityRestored, 'Entity Restored'],
    [EventType.EntityLineageAdded, 'Entity Lineage Added'],
    [EventType.EntityLineageUpdated, 'Entity Lineage Updated'],
    [EventType.EntityLineageDeleted, 'Entity Lineage Deleted'],
    [EventType.UserLogin, 'User Login'],
    [EventType.UserLogout, 'User Logout'],
  ])('should label the %s event as "%s"', (eventType, label) => {
    renderLogs([{ id: 1, eventTs: NOW, eventType, userName: 'admin' }]);

    expect(screen.getByTestId('event-type')).toHaveTextContent(label);
  });

  it('should show the entity type and the exact date-time with the relative time', () => {
    renderLogs([createdLog]);

    expect(screen.getByTestId('entity-type-badge')).toHaveTextContent(
      'Glossary'
    );
    expect(screen.getByTestId('timestamp')).toHaveTextContent(
      `${formatDateTime(createdLog.eventTs)} · ${getRelativeTime(
        createdLog.eventTs
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
    renderLogs([createdLog]);

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
      `/table/${TABLE_FQN}`
    );
    expect(screen.getByTestId('affected-entity-fqn')).toHaveTextContent(
      `(${TABLE_FQN})`
    );
    expect(screen.getByTestId('change-action')).toHaveTextContent(
      'label.added'
    );
    expect(screen.getByTestId('change-field-path')).toHaveTextContent(
      'Columns › customer_id › Tags:'
    );
    expect(screen.getByTestId('description-content')).toHaveTextContent(
      'PII.Sensitive'
    );
    expect(screen.getByTestId('description-content')).not.toHaveTextContent(
      'Server summary'
    );
  });

  it('should render tags, tiers, glossary terms and domains as core Tags', () => {
    renderLogs([
      updateLog({
        fieldsAdded: [
          {
            name: 'tags',
            newValue: JSON.stringify([
              { tagFQN: 'Tier.Tier1', name: 'Tier1' },
              { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
              { tagFQN: 'Business.Revenue', source: 'Glossary' },
            ]),
          },
          {
            name: 'domains',
            newValue: JSON.stringify([
              {
                type: 'domain',
                name: 'Customer360',
                fullyQualifiedName: 'Customer360',
                displayName: 'Customer 360',
              },
            ]),
          },
        ],
      }),
    ]);

    const tags = screen.getAllByRole('row');

    expect(tags.map((tag) => tag.textContent)).toEqual([
      'Tier1',
      'PII.Sensitive',
      'Business.Revenue',
      'Customer 360',
    ]);
    expect(screen.queryByTestId('change-ref')).not.toBeInTheDocument();
  });

  it('should show added and removed owners with the core OwnerChip', () => {
    renderLogs([
      updateLog({
        fieldsAdded: [
          {
            name: 'owners',
            newValue: JSON.stringify([
              { id: 'u-1', type: 'user', name: 'admin' },
            ]),
          },
        ],
        fieldsDeleted: [
          {
            name: 'owners',
            oldValue: JSON.stringify([
              {
                id: 't-1',
                type: 'team',
                name: 'Engineering',
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
    expect(screen.getByTestId('admin')).toHaveTextContent('admin');
    expect(
      screen.getByTestId('Engineering Team').closest('.tw\\:line-through')
    ).not.toBeNull();
    expect(
      screen.getByTestId('admin').closest('.tw\\:line-through')
    ).toBeNull();
    expect(screen.queryByTestId('change-ref')).not.toBeInTheDocument();
  });

  it('should show other entity references as linked chips with their type', () => {
    renderLogs([
      updateLog({
        fieldsAdded: [
          {
            name: 'dashboards',
            newValue: JSON.stringify([
              {
                id: 'd-1',
                type: 'dashboard',
                name: 'sales',
                fullyQualifiedName: 'looker.sales',
              },
            ]),
          },
        ],
      }),
    ]);

    const chip = screen.getByTestId('change-ref');

    expect(chip).toHaveTextContent('sales (dashboard)');
    expect(chip).toHaveAttribute('href', '/dashboard/looker.sales');
  });

  it('should show an update inline as struck-through old → highlighted new', () => {
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

    const row = screen.getByTestId('change-row');

    expect(row).toHaveTextContent(
      'Columns › customer_id › Description:The ID of the customer.→Unique customer identifier.'
    );

    const [before, after] = within(row).getAllByTestId('change-text');

    expect(before).toHaveTextContent('The ID of the customer.');
    expect(before).toHaveClass('tw:line-through');
    expect(after).toHaveTextContent('Unique customer identifier.');
    // Long descriptions are cut to three lines on both sides of the change.
    expect(before).toHaveClass('tw:line-clamp-3');
    expect(after).toHaveClass('tw:line-clamp-3');
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

    expect(disabledRow).toHaveTextContent('Disabled:true→false');
    expect(dataTypeRow).toHaveTextContent(
      'Columns › order.id › Data Type:INT→BIGINT'
    );
  });

  it('should show one inline record per object in a list', () => {
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

    expect(screen.getByTestId('change-row')).toHaveTextContent(
      'Test Case Result Summary:'
    );

    const record = screen.getByTestId('change-record');

    expect(record).toHaveTextContent(
      `statusAborted,timestamp${formatDateTime(
        resultTime
      )},testCaseNameorders_row_count`
    );
  });

  it('should show only the new records, without an arrow, when both sides are lists', () => {
    renderLogs([
      updateLog({
        fieldsUpdated: [
          {
            name: 'testCaseResultSummary',
            oldValue: JSON.stringify([
              { status: 'Failed', testCaseName: 'old_case' },
            ]),
            newValue: JSON.stringify([
              { status: 'Success', testCaseName: 'new_case' },
            ]),
          },
        ],
      }),
    ]);

    const row = screen.getByTestId('change-row');

    expect(row).not.toHaveTextContent('→');
    expect(screen.getByTestId('change-record')).toHaveTextContent('new_case');
    expect(row).not.toHaveTextContent('old_case');
  });

  it('should cap records and say how many are hidden', () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      name: `row-${index}`,
    }));
    renderLogs([
      updateLog({
        fieldsAdded: [{ name: 'results', newValue: JSON.stringify(rows) }],
      }),
    ]);

    expect(screen.getAllByTestId('change-record')).toHaveLength(5);
    expect(screen.getByText('label.plus-count-more')).toBeInTheDocument();
  });

  it('should render an object inline as key value pairs', () => {
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

    const row = screen.getByTestId('change-row');

    expect(row).toHaveTextContent(
      'Pipeline Status:runIdb7f39045…,configlabel.empty,pipelineStatesuccess'
    );
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

    expect(screen.getByTestId('description-content')).toHaveTextContent(
      'Soft deleted table: svc.db.schema.orders'
    );
    expect(screen.queryByTestId('change-row')).not.toBeInTheDocument();
  });

  it('should show a lineage edge as linked from → to, without the raw summary', () => {
    renderLogs([
      {
        id: 1,
        eventTs: NOW,
        eventType: EventType.EntityLineageAdded,
        userName: 'admin',
        entityType: 'lineage',
        entityFQN: 'svc.db.schema.customer--upstream-->svc.db.schema.orders',
        summary: 'entityLineageAdded',
        changeEvent: mockChangeEvent({
          eventType: EventType.EntityLineageAdded,
          entityType: 'lineage',
          entity: JSON.stringify({
            fromEntity: {
              type: 'table',
              name: 'customer',
              fullyQualifiedName: 'svc.db.schema.customer',
            },
            toEntity: {
              type: 'table',
              name: 'orders',
              fullyQualifiedName: 'svc.db.schema.orders',
            },
          }),
        }),
      },
    ]);

    expect(screen.getByTestId('affected-entity')).toHaveTextContent(
      'customer→orders'
    );
    expect(screen.getByRole('link', { name: 'customer' })).toHaveAttribute(
      'href',
      '/table/svc.db.schema.customer'
    );
    expect(screen.getByRole('link', { name: 'orders' })).toHaveAttribute(
      'href',
      '/table/svc.db.schema.orders'
    );
    expect(screen.getByTestId('description-content')).toBeEmptyDOMElement();
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

    expect(
      within(screen.getByTestId('affected-entity')).getByRole('link', {
        name: 'John Doe',
      })
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
});
