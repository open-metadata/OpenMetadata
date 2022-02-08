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

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import TableDataCard from './TableDataCard';

jest.mock('../../../utils/TableUtils', () => ({
  getEntityLink: jest.fn().mockReturnValue('EntityLink'),
  getEntityIcon: jest.fn().mockReturnValue(<p>icon</p>),
  getUsagePercentile: jest
    .fn()
    .mockImplementation((value = 0) => `${value} value`),
}));

jest.mock('../../../constants/constants', () => ({
  getDatasetDetailsPath: jest
    .fn()
    .mockImplementation((path) => `/dataset/${path}`),
}));

jest.mock('./TableDataCardBody', () => {
  return jest.fn().mockReturnValue(<p>TableDataCardBody</p>);
});

// const getDatasetDetailsPath = jest.fn();

describe('Test TableDataCard Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <TableDataCard
        fullyQualifiedName="testFQN"
        indexType="testIndex"
        name="test card"
        tags={[]}
      />,
      { wrapper: MemoryRouter }
    );
    const tableDataCard = getByTestId('table-data-card');

    expect(tableDataCard).toBeInTheDocument();
  });

  it('Component should render for deleted', () => {
    const { getByTestId } = render(
      <TableDataCard
        deleted
        fullyQualifiedName="testFQN"
        indexType="testIndex"
        name="test card"
        tags={[]}
      />,
      { wrapper: MemoryRouter }
    );
    const deleted = getByTestId('deleted');

    expect(deleted).toBeInTheDocument();
  });
});
