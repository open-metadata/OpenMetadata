/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { findByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import ServicesPage from './index';

const mockServiceDetails = {
  data: [
    {
      collection: {
        name: 'databaseServices',
        documentation: 'Database service collection',
        href: 'http://test',
      },
    },
  ],
};
const mockService = {
  data: {
    data: [
      {
        id: '847deda6-5342-42ed-b392-f0178a502c13',
        name: 'bigquery',
        serviceType: 'BigQuery',
        description: 'BigQuery service used for shopify data',
        href: 'http://localhost:8585/api/v1/services/databaseServices/847deda6-5342-42ed-b392-f0178a502c13',
        jdbc: {
          driverClass: 'jdbc',
          connectionUrl: 'jdbc://localhost',
        },
      },
    ],
  },
};

jest.mock('../../axiosAPIs/serviceAPI', () => ({
  deleteService: jest.fn(),
  getServiceDetails: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockServiceDetails })),
  getServices: jest.fn().mockImplementation(() => Promise.resolve(mockService)),
  postService: jest.fn(),
  updateService: jest.fn(),
}));

jest.mock(
  '../../components/common/rich-text-editor/RichTextEditorPreviewer',
  () => {
    return jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>);
  }
);

describe('Test Service page', () => {
  it('Check if there is an element in the page', async () => {
    const { container } = render(<ServicesPage />, {
      wrapper: MemoryRouter,
    });
    const services = await findByTestId(container, 'services-container');

    expect(services).toBeInTheDocument();
  });
});
