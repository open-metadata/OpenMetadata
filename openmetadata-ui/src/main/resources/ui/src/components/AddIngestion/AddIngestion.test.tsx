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

import { findByTestId, findByText, render } from '@testing-library/react';
import React from 'react';
import { DataObj } from '../../interface/service.interface';
import AddIngestion from './AddIngestion.component';
import { AddIngestionProps } from './addIngestion.interface';

const mockAddIngestionProps: AddIngestionProps = {
  serviceData: {
    name: 'serviceName',
  } as DataObj,
  handleAddIngestion: jest.fn(),
};

jest.mock('./Steps/ConfigureIngestion', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>ConfigureIngestion.component</div>);
});

describe('Test AddIngestion component', () => {
  it('AddIngestion component should render', async () => {
    const { container } = render(<AddIngestion {...mockAddIngestionProps} />);

    const addIngestionContainer = await findByTestId(
      container,
      'add-ingestion-container'
    );
    const configureIngestion = await findByText(
      container,
      'ConfigureIngestion.component'
    );

    expect(addIngestionContainer).toBeInTheDocument();
    expect(configureIngestion).toBeInTheDocument();
  });
});
