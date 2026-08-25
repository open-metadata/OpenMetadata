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

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuditLogEntry } from '../../types/auditLogs.interface';
import AuditLogList from './AuditLogList.component';

jest.mock('../common/ProfilePicture/ProfilePicture', () =>
  jest
    .fn()
    .mockImplementation(({ name, displayName }) => (
      <div data-testid="profile-picture">{displayName || name}</div>
    ))
);

jest.mock('../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="error-placeholder">No data</div>
    ))
);

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AuditLogList', () => {
  const mockLogs: AuditLogEntry[] = [
    {
      id: 1,
      changeEventId: 'event-1',
      eventTs: Date.now() - 60000,
      eventType: 'entityCreated',
      userName: 'admin',
      entityType: 'table',
      entityFQN: 'sample_data.ecommerce_db.shopify.orders',
      changeEvent: {
        id: 'ce-1',
        eventType: 'entityCreated',
        entityType: 'table',
        entityFullyQualifiedName: 'sample_data.ecommerce_db.shopify.orders',
        entity: {
          id: 'table-1',
          name: 'orders',
          displayName: 'Orders',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.orders',
        },
        changeDescription: {
          fieldsAdded: [],
          fieldsUpdated: [],
          fieldsDeleted: [],
        },
        timestamp: Date.now() - 60000,
      },
    },
    {
      id: 2,
      changeEventId: 'event-2',
      eventTs: Date.now() - 120000,
      eventType: 'entityUpdated',
      userName: 'test_user',
      entityType: 'table',
      entityFQN: 'sample_data.ecommerce_db.shopify.products',
      changeEvent: {
        id: 'ce-2',
        eventType: 'entityUpdated',
        entityType: 'table',
        entityFullyQualifiedName: 'sample_data.ecommerce_db.shopify.products',
        entity: {
          id: 'table-2',
          name: 'products',
          displayName: 'Products',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.products',
        },
        changeDescription: {
          fieldsAdded: [
            {
              name: 'tags',
              newValue: JSON.stringify([
                { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
              ]),
            },
          ],
          fieldsUpdated: [],
          fieldsDeleted: [],
        },
        timestamp: Date.now() - 120000,
      },
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render loading state', () => {
    renderWithRouter(<AuditLogList isLoading logs={[]} />);

    const skeletons = document.querySelectorAll('.ant-skeleton');

    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render empty state when no logs', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={[]} />);

    expect(screen.getByTestId('error-placeholder')).toBeInTheDocument();
  });

  it('should render list with items', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={mockLogs} />);

    expect(screen.getByTestId('audit-log-list')).toBeInTheDocument();

    const listItems = screen.getAllByTestId('audit-log-list-item');

    expect(listItems).toHaveLength(2);
  });

  it('should display profile pictures for each log entry', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={mockLogs} />);

    const profilePictures = screen.getAllByTestId('profile-picture');

    expect(profilePictures).toHaveLength(2);
  });

  it('should display user names as links', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={mockLogs} />);

    const adminLink = screen.getByRole('link', { name: 'admin' });

    expect(adminLink).toHaveAttribute('href', '/users/admin');

    const testUserLink = screen.getByRole('link', { name: 'test_user' });

    expect(testUserLink).toHaveAttribute('href', '/users/test_user');
  });

  it('should display event types', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={mockLogs} />);

    const eventTypes = screen.getAllByTestId('event-type');

    expect(eventTypes).toHaveLength(2);
    expect(eventTypes[0]).toHaveTextContent('Entity Created');
    expect(eventTypes[1]).toHaveTextContent('Entity Updated');
  });

  it('should display entity type badges', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={mockLogs} />);

    const entityTypeBadges = document.querySelectorAll('.entity-type-badge');

    expect(entityTypeBadges).toHaveLength(2);
    expect(entityTypeBadges[0]).toHaveTextContent('Table');
  });

  it('should display relative timestamps', () => {
    renderWithRouter(<AuditLogList isLoading={false} logs={mockLogs} />);

    const timestamps = document.querySelectorAll('.timestamp');

    expect(timestamps).toHaveLength(2);
  });

  it('should render tag links when tags are added', () => {
    const logsWithTags: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'tags',
                newValue: JSON.stringify([
                  { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
                ]),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithTags} />);

    const tagLink = screen.getByRole('link', { name: 'Sensitive' });

    expect(tagLink).toHaveAttribute('href', '/tags/PII.Sensitive');
  });

  it('should render data product links when data products are added', () => {
    const logsWithDataProduct: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'dataProducts',
                newValue: JSON.stringify([
                  {
                    fullyQualifiedName: 'sales-dp',
                    name: 'Sales Data Product',
                    displayName: 'Sales Data Product',
                  },
                ]),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(
      <AuditLogList isLoading={false} logs={logsWithDataProduct} />
    );

    const dpLink = screen.getByRole('link', { name: 'Sales Data Product' });

    expect(dpLink).toHaveAttribute('href', '/dataProduct/sales-dp');
  });

  it('should render domain links when domain is updated', () => {
    const logsWithDomain: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'domain',
                newValue: JSON.stringify({
                  fullyQualifiedName: 'Engineering',
                  name: 'Engineering',
                  displayName: 'Engineering Domain',
                }),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithDomain} />);

    const domainLink = screen.getByRole('link', { name: 'Engineering Domain' });

    expect(domainLink).toHaveAttribute('href', '/domain/Engineering');
  });

  it('should render owner links when owner is added', () => {
    const logsWithOwner: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'owner',
                newValue: JSON.stringify({
                  fullyQualifiedName: 'john_doe',
                  name: 'john_doe',
                  displayName: 'John Doe',
                }),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithOwner} />);

    const ownerLink = screen.getByRole('link', { name: 'John Doe' });

    expect(ownerLink).toHaveAttribute('href', '/users/john_doe');
  });

  it('should render profile picture for owner field changes', () => {
    const logsWithOwner: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'owner',
                newValue: JSON.stringify({
                  fullyQualifiedName: 'john_doe',
                  name: 'john_doe',
                  displayName: 'John Doe',
                }),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithOwner} />);

    const profilePictures = screen.getAllByTestId('profile-picture');

    expect(profilePictures.length).toBeGreaterThanOrEqual(2);
  });

  it('should render teams links when teams are added', () => {
    const logsWithTeams: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'user',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'user',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'teams',
                newValue: JSON.stringify([
                  {
                    fullyQualifiedName: 'Engineering',
                    name: 'Engineering',
                    displayName: 'Engineering Team',
                  },
                ]),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithTeams} />);

    const teamLink = screen.getByRole('link', { name: 'Engineering Team' });

    expect(teamLink).toHaveAttribute(
      'href',
      '/settings/members/teams/Engineering'
    );
  });

  it('should display summary when available', () => {
    const logsWithSummary: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityCreated',
        userName: 'admin',
        entityType: 'table',
        summary: 'Created table orders with 5 columns',
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithSummary} />);

    expect(
      screen.getByText('Created table orders with 5 columns')
    ).toBeInTheDocument();
  });

  it('should display System for logs without userName', () => {
    const systemLogs: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        entityType: 'table',
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={systemLogs} />);

    const profilePictures = screen.getAllByTestId('profile-picture');

    expect(profilePictures[0]).toHaveTextContent('label.system');
  });

  it('should render multiple field changes', () => {
    const logsWithMultipleChanges: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'tags',
                newValue: JSON.stringify([
                  { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
                ]),
              },
            ],
            fieldsUpdated: [
              {
                name: 'description',
                oldValue: 'Old description',
                newValue: 'New description',
              },
            ],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(
      <AuditLogList isLoading={false} logs={logsWithMultipleChanges} />
    );

    const listItem = screen.getByTestId('audit-log-list-item');

    expect(listItem.textContent).toMatch(/Tags/i);
    expect(listItem.textContent).toMatch(/Description/i);
  });

  it('should render field deletions', () => {
    const logsWithDeletions: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [],
            fieldsUpdated: [],
            fieldsDeleted: [
              {
                name: 'tags',
                oldValue: JSON.stringify([
                  { tagFQN: 'PII.Sensitive', name: 'Sensitive' },
                ]),
              },
            ],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(
      <AuditLogList isLoading={false} logs={logsWithDeletions} />
    );

    expect(screen.getByText(/Tags/i)).toBeInTheDocument();
  });

  it('should render reviewers links when reviewers are added', () => {
    const logsWithReviewers: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'glossaryTerm',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'glossaryTerm',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'reviewers',
                newValue: JSON.stringify([
                  {
                    fullyQualifiedName: 'jane_doe',
                    name: 'jane_doe',
                    displayName: 'Jane Doe',
                  },
                ]),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(
      <AuditLogList isLoading={false} logs={logsWithReviewers} />
    );

    const reviewerLink = screen.getByRole('link', { name: 'Jane Doe' });

    expect(reviewerLink).toHaveAttribute('href', '/users/jane_doe');
  });

  it('should render experts links when experts are added', () => {
    const logsWithExperts: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'domain',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'domain',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'experts',
                newValue: JSON.stringify([
                  {
                    fullyQualifiedName: 'expert_user',
                    name: 'expert_user',
                    displayName: 'Expert User',
                  },
                ]),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithExperts} />);

    const expertLink = screen.getByRole('link', { name: 'Expert User' });

    expect(expertLink).toHaveAttribute('href', '/users/expert_user');
  });

  it('should render profile pictures for reviewers', () => {
    const logsWithReviewers: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'glossaryTerm',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'glossaryTerm',
          changeDescription: {
            fieldsAdded: [
              {
                name: 'reviewers',
                newValue: JSON.stringify([
                  {
                    fullyQualifiedName: 'reviewer1',
                    name: 'reviewer1',
                    displayName: 'Reviewer One',
                  },
                ]),
              },
            ],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(
      <AuditLogList isLoading={false} logs={logsWithReviewers} />
    );

    const profilePictures = screen.getAllByTestId('profile-picture');

    expect(profilePictures.length).toBeGreaterThanOrEqual(2);
  });

  it('should render field updates with old and new values', () => {
    const logsWithUpdates: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'table',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'table',
          changeDescription: {
            fieldsAdded: [],
            fieldsUpdated: [
              {
                name: 'owner',
                oldValue: JSON.stringify({
                  fullyQualifiedName: 'old_owner',
                  name: 'old_owner',
                  displayName: 'Old Owner',
                }),
                newValue: JSON.stringify({
                  fullyQualifiedName: 'new_owner',
                  name: 'new_owner',
                  displayName: 'New Owner',
                }),
              },
            ],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithUpdates} />);

    expect(screen.getByRole('link', { name: 'Old Owner' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New Owner' })).toBeInTheDocument();
  });

  it('should render entity link for table entity type', () => {
    const logsWithTable: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityCreated',
        userName: 'admin',
        entityType: 'table',
        entityFQN: 'sample_data.ecommerce_db.shopify.orders',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityCreated',
          entityType: 'table',
          entityFullyQualifiedName: 'sample_data.ecommerce_db.shopify.orders',
          entity: {
            id: 'table-1',
            name: 'orders',
            displayName: 'Orders Table',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.orders',
          },
          changeDescription: {
            fieldsAdded: [],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithTable} />);

    const entityLink = screen.getByRole('link', { name: 'Orders Table' });

    expect(entityLink).toHaveAttribute(
      'href',
      '/table/sample_data.ecommerce_db.shopify.orders'
    );
  });

  it('should render user entity link', () => {
    const logsWithUser: AuditLogEntry[] = [
      {
        id: 1,
        changeEventId: 'event-1',
        eventTs: Date.now(),
        eventType: 'entityUpdated',
        userName: 'admin',
        entityType: 'user',
        changeEvent: {
          id: 'ce-1',
          eventType: 'entityUpdated',
          entityType: 'user',
          entity: {
            id: 'user-1',
            name: 'john_doe',
            displayName: 'John Doe',
            fullyQualifiedName: 'john_doe',
          },
          changeDescription: {
            fieldsAdded: [],
            fieldsUpdated: [],
            fieldsDeleted: [],
          },
          timestamp: Date.now(),
        },
      },
    ];

    renderWithRouter(<AuditLogList isLoading={false} logs={logsWithUser} />);

    const entityLink = screen.getByRole('link', { name: 'John Doe' });

    expect(entityLink).toHaveAttribute('href', '/users/john_doe');
  });
});
