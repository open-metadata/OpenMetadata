/*
 *  Copyright 2023 Collate.
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
import { EntityType } from '../../enums/entity.enum';
import {
  Database,
  DatabaseServiceType,
} from '../../generated/entity/data/database';
import {
  MOCK_CHANGE_DESCRIPTION,
  MOCK_DATABASE_SERVICE,
} from '../../mocks/Service.mock';
import ServiceVersionMainTabContent from './ServiceVersionMainTabContent';
import { ServiceVersionMainTabContentProps } from './ServiceVersionMainTabContent.interface';

const mockParams = {
  serviceCategory: 'databaseServices',
  version: '1.2',
  serviceFQN: 'sample_data',
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/Tag/TagsViewer/TagsViewer', () =>
  jest.fn().mockImplementation(() => <div>TagsViewer</div>)
);

jest.mock('../../components/common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(() => <div>ProfilePicture</div>)
);

jest.mock('../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../components/common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);

jest.mock('../../components/common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(() => <div>NextPrevious</div>)
);

jest.mock(
  '../../components/common/RichTextEditor/RichTextEditorPreviewer',
  () => jest.fn().mockImplementation(() => <div>RichTextEditorPreviewer</div>)
);

const mockPagingHandler = jest.fn();
const mockData: Database[] = [
  {
    id: '79627fa0-a4c1-4a8a-a00f-12a5c70cd2db',
    name: 'ecommerce_db',
    fullyQualifiedName: 'sample_data.ecommerce_db',
    description:
      'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
    tags: [],
    version: 0.5,
    updatedAt: 1692852095047,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/databases/79627fa0-a4c1-4a8a-a00f-12a5c70cd2db',
    owner: {
      id: '4d9d9c11-7947-41a9-93fa-3afcec298765',
      type: 'user',
      name: 'adam_rodriguez9',
      fullyQualifiedName: 'adam_rodriguez9',
      displayName: 'Adam Rodriguez',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/4d9d9c11-7947-41a9-93fa-3afcec298765',
    },
    service: {
      id: '958a73c6-55d0-490f-8024-2a78a446d1db',
      type: 'databaseService',
      name: 'sample_data',
      fullyQualifiedName: 'sample_data',
      description: 'New Description',
      displayName: 'Sample Data',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/databaseServices/958a73c6-55d0-490f-8024-2a78a446d1db',
    },
    serviceType: DatabaseServiceType.BigQuery,
    usageSummary: {
      dailyStats: {
        count: 0,
        percentileRank: 0,
      },
      weeklyStats: {
        count: 0,
        percentileRank: 0,
      },
      monthlyStats: {
        count: 0,
        percentileRank: 0,
      },
      date: new Date('"2023-08-24"'),
    },
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [],
      fieldsDeleted: [
        {
          name: 'displayName',
          oldValue: 'Ecommerce DB',
        },
      ],
      previousVersion: 0.4,
    },
    default: false,
    deleted: false,
  },
];

const props: ServiceVersionMainTabContentProps = {
  serviceName: 'sample_data',
  data: mockData,
  isServiceLoading: false,
  paging: { total: 1 },
  pagingHandler: mockPagingHandler,
  currentPage: 1,
  serviceDetails: MOCK_DATABASE_SERVICE,
  entityType: EntityType.DATABASE_SERVICE,
  changeDescription: MOCK_CHANGE_DESCRIPTION,
};

describe('ServiceVersionMainTabContent tests', () => {
  it('Component should render properly provided proper data', () => {
    render(<ServiceVersionMainTabContent {...props} />, {
      wrapper: MemoryRouter,
    });

    const entityTable = screen.getByTestId('service-children-table');
    const entityName = screen.getByText('ecommerce_db');
    const entityOwnerName = screen.getByText('Adam Rodriguez');
    const entityDescription = screen.getByText('RichTextEditorPreviewer');

    expect(entityTable).toBeInTheDocument();
    expect(screen.getByText('DescriptionV1')).toBeInTheDocument();
    expect(screen.getByTestId('entity-right-panel')).toBeInTheDocument();
    expect(screen.queryByText('NextPrevious')).toBeNull();
    expect(screen.getAllByText('TagsContainerV2')).toHaveLength(2);
    expect(entityName).toBeInTheDocument();
    expect(entityOwnerName).toBeInTheDocument();
    expect(entityDescription).toBeInTheDocument();
    expect(entityTable.contains(entityName)).toBe(true);
    expect(entityTable.contains(entityOwnerName)).toBe(true);
    expect(entityTable.contains(entityDescription)).toBe(true);
  });

  it('Loader should be displayed if isServiceLoading is true', async () => {
    render(<ServiceVersionMainTabContent {...props} isServiceLoading />, {
      wrapper: MemoryRouter,
    });

    const loader = await screen.findByTestId('skeleton-table');

    expect(loader).toBeInTheDocument();
  });
});
