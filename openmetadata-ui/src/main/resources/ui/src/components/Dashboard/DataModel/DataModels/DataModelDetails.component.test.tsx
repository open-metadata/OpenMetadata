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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  DashboardDataModel,
  DataModelType,
} from '../../../../generated/entity/data/dashboardDataModel';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import PageLayoutV1 from '../../../PageLayoutV1/PageLayoutV1';
import DataModelDetails from './DataModelDetails.component';
import { DataModelDetailsProps } from './DataModelDetails.interface';

const mockDataModelData: DashboardDataModel = {
  id: 'test-datamodel-id',
  name: 'test-datamodel',
  displayName: 'Test Data Model',
  fullyQualifiedName: 'test.datamodel',
  description: 'Test data model description',
  version: 0.1,
  updatedAt: 1234567890,
  updatedBy: 'test-user',
  href: 'http://test.com',
  service: {
    id: 'test-service-id',
    type: 'dashboardService',
    name: 'test-service',
    fullyQualifiedName: 'test-service',
    deleted: false,
  },
  columns: [],
  dataModelType: DataModelType.LookMlExplore,
};

const mockProps: DataModelDetailsProps = {
  dataModelData: mockDataModelData,
  dataModelPermissions: DEFAULT_ENTITY_PERMISSION,
  updateDataModelDetailsState: jest.fn(),
  fetchDataModel: jest.fn(),
  handleFollowDataModel: jest.fn(),
  handleUpdateOwner: jest.fn(),
  handleUpdateTier: jest.fn(),
  onUpdateDataModel: jest.fn(),
  handleToggleDelete: jest.fn(),
  onUpdateVote: jest.fn(),
};

jest.mock('../../../PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('testEntityName'),
}));

jest.mock('../../../../hooks/useCustomPages', () => ({
  useCustomPages: jest.fn().mockReturnValue({
    customizedPage: undefined,
    isLoading: false,
  }),
}));

jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({
    fqn: 'test.datamodel',
  }),
}));

jest.mock('../../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'model',
  }),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getFeedCounts: jest.fn(),
  extractEntityFqnAndColumnPart: jest.fn().mockReturnValue({
    entityFqn: 'test.datamodel',
    columnPart: undefined,
  }),
}));

jest.mock(
  '../../../DataAssets/DataAssetsHeader/DataAssetsHeader.component',
  () => ({
    DataAssetsHeader: jest.fn().mockReturnValue(<div>DataAssetsHeader</div>),
  })
);

jest.mock('../../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../../AppRouter/withActivityFeed', () => ({
  withActivityFeed: jest.fn().mockImplementation((component) => component),
}));

jest.mock('../../../../utils/DashboardDataModelClassBase', () => ({
  __esModule: true,
  default: {
    getDashboardDataModelDetailPageTabs: jest.fn().mockReturnValue([]),
  },
}));

jest.mock('../../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getTabLabelMapFromTabs: jest.fn().mockReturnValue({}),
  getDetailsTabWithNewLabel: jest.fn().mockReturnValue([]),
  checkIfExpandViewSupported: jest.fn().mockReturnValue(false),
}));

describe('DataModelDetails component', () => {
  it('should render successfully', () => {
    const { container } = render(<DataModelDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(container).toBeInTheDocument();
  });

  it('should pass entity name as pageTitle to PageLayoutV1', () => {
    render(<DataModelDetails {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(PageLayoutV1).toHaveBeenCalledWith(
      expect.objectContaining({
        pageTitle: 'testEntityName',
      }),
      expect.anything()
    );
  });
});
