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
import { MemoryRouter } from 'react-router';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
import DatasetDetailsPage from './DatasetDetailsPage.component';

const mockUseParams = {
  datasetFQN: 'bigquery_gcp:shopify:dim_address',
  tab: 'schema',
};

jest.mock('../../components/DatasetDetails/DatasetDetails.component', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="datasetdetails-component" />);
});

jest.mock(
  '../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
  }
);

jest.mock('../../hooks/useToastContext', () => {
  return jest.fn().mockImplementation(() => jest.fn());
});

jest.mock('../../axiosAPIs/tableAPI', () => ({
  addColumnTestCase: jest.fn(),
  addFollower: jest.fn(),
  addTableTestCase: jest.fn(),
  deleteColumnTestCase: jest.fn(),
  deleteTableTestCase: jest.fn(),
  getTableDetailsByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
  patchTableDetails: jest.fn(),
  removeFollower: jest.fn(),
}));

jest.mock('../../axiosAPIs/feedsAPI', () => ({
  getAllFeeds: jest.fn().mockImplementation(() => Promise.resolve()),
  getFeedCount: jest.fn().mockImplementation(() => Promise.resolve()),
  postFeedById: jest.fn(),
  postThread: jest.fn(),
}));

jest.mock('../../axiosAPIs/lineageAPI', () => ({
  getLineageByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  addLineage: jest.fn(),
  deleteLineageEdge: jest.fn(),
}));

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => mockUseParams),
}));

describe('Test DatasetDetails page', () => {
  it('Component should render', async () => {
    const { container } = render(<DatasetDetailsPage />, {
      wrapper: MemoryRouter,
    });
    const ContainerText = await findByTestId(
      container,
      'datasetdetails-component'
    );

    expect(ContainerText).toBeInTheDocument();
  });

  describe('Render Sad Paths', () => {
    it('ErrorPlaceholder should be visible if there is error with status code 404', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' }, status: 404 },
        })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const errorPlaceholder = await findByText(
        container,
        /ErrorPlaceHolder.component/i
      );

      expect(errorPlaceholder).toBeInTheDocument();
    });

    it('ErrorPlaceholder should not visible if status code is other than 404 and message is present', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({
          response: { data: { message: 'Error!' } },
        })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });

    it('ErrorPlaceholder should not visible if status code is other than 404 and response message is not present', async () => {
      (getTableDetailsByFQN as jest.Mock).mockImplementationOnce(() =>
        Promise.reject({ response: { message: '' } })
      );
      const { container } = render(<DatasetDetailsPage />, {
        wrapper: MemoryRouter,
      });
      const ContainerText = await findByTestId(
        container,
        'datasetdetails-component'
      );

      expect(ContainerText).toBeInTheDocument();
    });
  });
});
