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
import { BrowserRouter } from 'react-router-dom';
import { DomainType } from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import DomainTable from './DomainsTable.component';
import { DomainTableProps } from './DomainTable.interface';

const mockDomains: Domain[] = [
  {
    id: '1',
    name: 'test-domain',
    fullyQualifiedName: 'test.domain',
    displayName: 'Test Domain',
    description: 'Test domain description',
    domainType: DomainType.Aggregate,
  },
];

const mockColumns = [
  {
    key: 'displayName',
    title: 'Name',
    dataIndex: 'displayName',
  },
  {
    key: 'description',
    title: 'Description',
    dataIndex: 'description',
  },
];

const defaultProps: DomainTableProps = {
  columns: mockColumns,
  data: mockDomains,
  loading: false,
};

const MockWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('DomainsTable', () => {
  it('should render table with basic props', () => {
    render(
      <MockWrapper>
        <DomainTable {...defaultProps} />
      </MockWrapper>
    );

    expect(screen.getByText('Test Domain')).toBeInTheDocument();
    expect(screen.getByText('Test domain description')).toBeInTheDocument();
  });

  it('should render selection column when showSelection is true', () => {
    const selectionProps: DomainTableProps = {
      ...defaultProps,
      showSelection: true,
      selectedRows: [],
      onSelectionChange: jest.fn(),
    };

    render(
      <MockWrapper>
        <DomainTable {...selectionProps} />
      </MockWrapper>
    );

    expect(screen.getByTestId('select-all-checkbox')).toBeInTheDocument();
    expect(screen.getByTestId('test-domain-checkbox')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    const loadingProps: DomainTableProps = {
      ...defaultProps,
      loading: true,
    };

    render(
      <MockWrapper>
        <DomainTable {...loadingProps} />
      </MockWrapper>
    );

    // Table should still render but with loading state
    expect(screen.getByText('Test Domain')).toBeInTheDocument();
  });
});
