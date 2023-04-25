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

import { act, render, screen } from '@testing-library/react';
import {
  Constraint,
  Container,
  DataType,
  FileFormat,
  StorageServiceType,
} from 'generated/entity/data/container';
import React from 'react';
import ContainerSummary from './ContainerSummary.component';

jest.mock('../SummaryList/SummaryList.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="SummaryList">SummaryList</div>)
);

const mockEntityDetails: Container = {
  id: '63be99e5-8ebf-44b6-8247-0f4faed00798',
  name: 'transactions',
  fullyQualifiedName: 's3_storage_sample.transactions',
  displayName: 'Company Transactions',
  description: "Bucket containing all the company's transactions",
  version: 0.1,
  updatedAt: 1678969800877,
  updatedBy: 'admin',
  href: 'http://openmetadata-server:8585/api/v1/containers/63be99e5-8ebf-44b6-8247-0f4faed00798',
  service: {
    id: '7ab99e67-b578-4361-bad2-9076a52b341d',
    type: 'storageService',
    name: 's3_storage_sample',
    fullyQualifiedName: 's3_storage_sample',
    deleted: false,
    href: 'http://openmetadata-server:8585/api/v1/services/storageServices/7ab99e67-b578-4361-bad2-9076a52b341d',
  },
  dataModel: {
    isPartitioned: true,
    columns: [
      {
        name: 'transaction_id',
        dataType: DataType.Numeric,
        dataTypeDisplay: 'numeric',
        description:
          'The ID of the executed transaction. This column is the primary key for this table.',
        fullyQualifiedName: 's3_storage_sample.transactions.transaction_id',
        tags: [],
        constraint: Constraint.PrimaryKey,
        ordinalPosition: 1,
      },
      {
        name: 'merchant',
        dataType: DataType.Varchar,
        dataLength: 100,
        dataTypeDisplay: 'varchar',
        description: 'The merchant for this transaction.',
        fullyQualifiedName: 's3_storage_sample.transactions.merchant',
        tags: [],
        ordinalPosition: 2,
      },
      {
        name: 'transaction_time',
        dataType: DataType.Timestamp,
        dataTypeDisplay: 'timestamp',
        description: 'The time the transaction took place.',
        fullyQualifiedName: 's3_storage_sample.transactions.transaction_time',
        tags: [],
        ordinalPosition: 3,
      },
    ],
  },
  prefix: '/transactions/',
  numberOfObjects: 50,
  size: 102400,
  fileFormats: [FileFormat.Parquet],
  serviceType: StorageServiceType.S3,
  deleted: false,
  tags: [],
  followers: [],
};

describe('ContainerSummary component tests', () => {
  it('Component should render properly, when loaded in the Explore page.', async () => {
    await act(async () => {
      render(<ContainerSummary entityDetails={mockEntityDetails} />);
    });

    const numberOfObjects = screen.getByTestId('label.number-of-object-value');
    const serviceType = screen.getByTestId('label.service-type-value');
    const colsLength = screen.getByTestId('label.column-plural-value');
    const summaryList = screen.getByTestId('SummaryList');

    expect(numberOfObjects).toBeInTheDocument();
    expect(serviceType).toBeInTheDocument();
    expect(colsLength).toBeInTheDocument();
    expect(summaryList).toBeInTheDocument();
  });
});
