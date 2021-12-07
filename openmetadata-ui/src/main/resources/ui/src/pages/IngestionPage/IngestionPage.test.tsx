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

import { findByText, render } from '@testing-library/react';
import React from 'react';
import IngestionPage from './IngestionPage.component';
import { mockIngestionWorkFlow, mockService } from './IngestionPage.mock';

jest.mock('../../components/Ingestion/Ingestion.component', () => {
  return jest.fn().mockReturnValue(<p>Ingestion Component</p>);
});

jest.mock('../../axiosAPIs/serviceAPI', () => ({
  getServices: jest.fn().mockImplementation(() => Promise.resolve(mockService)),
}));

jest.mock('../../axiosAPIs/ingestionWorkflowAPI', () => ({
  addIngestionWorkflow: jest.fn(),
  deleteIngestionWorkflowsById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  getIngestionWorkflows: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockIngestionWorkFlow)),
  triggerIngestionWorkflowsById: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  updateIngestionWorkflow: jest.fn(),
}));

describe('Test Ingestion page', () => {
  it('Page Should render', async () => {
    const { container } = render(<IngestionPage />);

    const ingestionPage = await findByText(container, /Ingestion Component/i);

    expect(ingestionPage).toBeInTheDocument();
  });
});
