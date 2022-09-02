/*
 *  Copyright 2021 Collate
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
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Webhook } from '../../generated/entity/events/webhook';
import WebhookTable from './WebhookTable';

jest.mock('../../constants/HelperTextUtil', () => ({
  NO_PERMISSION_FOR_ACTION: '',
}));

jest.mock('../../utils/CommonUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('data'),
  getHostNameFromURL: jest.fn().mockReturnValue('hostname'),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
}));

jest.mock('../../utils/StringsUtils', () => ({
  stringToHTML: jest.fn().mockReturnValue('value'),
}));

jest.mock('../common/rich-text-editor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<div>Previewer</div>)
);

jest.mock('../PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    permissions: {
      webhook: {
        Create: true,
        Delete: true,
        ViewAll: true,
        EditAll: true,
        EditDescription: true,
        EditDisplayName: true,
        EditCustomFields: true,
      },
    },
  }),
}));

const mockWebhooks = [
  {
    id: '916605d8-55e4-411f-909d-8237eecaf9d5',
    name: 'TestingSlack',
    fullyQualifiedName: 'TestingSlack',
    webhookType: 'slack',
    description: '',
    endpoint: '',
    eventFilters: [
      {
        entityType: 'all',
        filters: [
          {
            eventType: 'entityCreated',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entitySoftDeleted',
            include: ['all'],
            exclude: [],
          },
        ],
      },
      {
        entityType: 'topic',
        filters: [
          {
            eventType: 'entityCreated',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entitySoftDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
        ],
      },
      {
        entityType: 'dashboard',
        filters: [
          {
            eventType: 'entityCreated',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entitySoftDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
        ],
      },
      {
        entityType: 'pipeline',
        filters: [
          {
            eventType: 'entityCreated',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entitySoftDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
        ],
      },
      {
        entityType: 'mlmodel',
        filters: [
          {
            eventType: 'entityCreated',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entitySoftDeleted',
            include: ['all'],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
          {
            eventType: 'entityUpdated',
            include: [],
            exclude: [],
          },
        ],
      },
    ],
    batchSize: 10,
    timeout: 10,
    readTimeout: 12,
    enabled: true,
    secretKey: '',
    version: 0.5,
    updatedAt: 1662104813212,
    updatedBy: 'sachin.c',
    status: 'active',
    href: 'http://localhost:8585/api/v1/webhook/916605d8-55e4-411f-909d-8237eecaf9d5',
  } as Webhook,
];

const onEdit = jest.fn();
const onDelete = jest.fn();

const mockProps = {
  webhookList: mockWebhooks,
  onEdit,
  onDelete,
};

describe('Test Webhook table component', () => {
  it('should render the table component', async () => {
    render(<WebhookTable {...mockProps} />, { wrapper: MemoryRouter });

    const name = await screen.findByText('Name');
    const status = await screen.findByText('Status');
    const url = await screen.findByText('Url');
    const description = await screen.findByText('Description');
    const actions = await screen.findByText('Actions');

    expect(name).toBeInTheDocument();
    expect(status).toBeInTheDocument();
    expect(url).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(actions).toBeInTheDocument();
  });
});
