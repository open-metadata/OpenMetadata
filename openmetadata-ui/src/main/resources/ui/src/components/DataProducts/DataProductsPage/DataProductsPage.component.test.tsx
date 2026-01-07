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

import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import DataProductsPage from './DataProductsPage.component';

const mockDataProduct: DataProduct = {
  id: 'test-dataproduct-id',
  name: 'test-dataproduct',
  displayName: 'Test Data Product',
  fullyQualifiedName: 'test.dataproduct',
  description: 'Test data product description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
};

jest.mock('../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: 'testUser',
    },
  }),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test.dataproduct',
  }),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    version: undefined,
  }),
}));

jest.mock('../../../rest/dataProductAPI', () => ({
  getDataProductByName: jest.fn().mockResolvedValue(mockDataProduct),
  getDataProductVersionsList: jest.fn().mockResolvedValue({}),
  getDataProductVersionData: jest.fn().mockResolvedValue(mockDataProduct),
  patchDataProduct: jest.fn().mockResolvedValue(mockDataProduct),
  deleteDataProduct: jest.fn().mockResolvedValue({}),
  addFollower: jest.fn().mockResolvedValue({
    changeDescription: {
      fieldsAdded: [{ newValue: [] }],
    },
  }),
  removeFollower: jest.fn().mockResolvedValue({
    changeDescription: {
      fieldsDeleted: [{ oldValue: [{ id: 'testUser' }] }],
    },
  }),
}));

jest.mock(
  '../DataProductsDetailsPage/DataProductsDetailsPage.component',
  () => {
    return jest.fn().mockReturnValue(<div>DataProductsDetailsPage</div>);
  }
);

jest.mock('../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () => {
  return jest.fn().mockReturnValue(<div>EntityVersionTimeLine</div>);
});

describe('DataProductsPage component', () => {
  it('should render successfully', async () => {
    const { container } = render(<DataProductsPage />, {
      wrapper: MemoryRouter,
    });

    await waitFor(() => {
      expect(container).toBeInTheDocument();
    });
  });

  it('should pass entity name as pageTitle to PageLayoutV1', async () => {
    render(<DataProductsPage />, {
      wrapper: MemoryRouter,
    });

    await waitFor(() => {
      expect(PageLayoutV1).toHaveBeenCalledWith(
        expect.objectContaining({
          pageTitle: 'testEntityName',
        }),
        expect.anything()
      );
    });
  });
});
