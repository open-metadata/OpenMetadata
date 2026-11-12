/*
 *  Copyright 2026 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../../../context/PermissionProvider/PermissionProvider.interface';
import { ENTITY_PERMISSIONS } from '../../../../../mocks/Permissions.mock';
import MetadataAgentsWidget from './MetadataAgentsWidget';
import { MetadataAgentsWidgetProps } from './MetadataAgentsWidget.interface';

const mockUsePermissionProvider = jest.fn();

jest.mock(
  '../../../../../context/PermissionProvider/PermissionProvider',
  () => ({
    usePermissionProvider: () => mockUsePermissionProvider(),
  })
);

jest.mock('../AddIngestionButton.component', () => ({
  __esModule: true,
  default: () => <div>AddIngestionButton</div>,
}));

jest.mock('../IngestionListTable/IngestionListTable', () => ({
  __esModule: true,
  default: () => <div>IngestionListTable</div>,
}));

jest.mock('../../../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({ serviceCategory: 'databaseServices' }),
}));

jest.mock('../../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: { getExtraIngestionMenuItems: jest.fn().mockReturnValue([]) },
}));

const NO_PERMISSION = Object.fromEntries(
  Object.keys(ENTITY_PERMISSIONS).map((key) => [key, false])
) as unknown as OperationPermission;

const props = {
  serviceName: 'svc',
  serviceDetails: {},
  ingestionPipelineList: [],
  ingestionPagingInfo: {},
  searchText: '',
  airflowInformation: { isFetchingStatus: false, platform: 'Airflow' },
  onIngestionWorkflowsUpdate: jest.fn(),
  handleIngestionListUpdate: jest.fn(),
  onPageChange: jest.fn(),
} as unknown as MetadataAgentsWidgetProps;

const renderWidget = async (
  servicePermission: Partial<OperationPermission>
) => {
  mockUsePermissionProvider.mockReturnValue({
    permissions: { ingestionPipeline: NO_PERMISSION },
  });
  render(
    <MemoryRouter>
      <MetadataAgentsWidget
        {...props}
        servicePermission={{ ...NO_PERMISSION, ...servicePermission }}
      />
    </MemoryRouter>
  );
};

describe('MetadataAgentsWidget Add gate', () => {
  it.each(['Create', 'EditAll'] as const)(
    'shows Add when the service grants %s but the global permission does not',
    async (operation) => {
      await renderWidget({ [operation]: true });

      expect(await screen.findByText('AddIngestionButton')).toBeInTheDocument();
    }
  );

  it('hides Add when neither the service nor the global permission grants it', async () => {
    await renderWidget({});

    expect(screen.queryByText('AddIngestionButton')).toBeNull();
  });
});
