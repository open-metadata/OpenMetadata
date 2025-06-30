/*
 *  Copyright 2022 Collate.
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

import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { Table } from '../../../generated/entity/data/table';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { CustomPropertyTable } from './CustomPropertyTable';

const mockCustomProperties = [
  {
    name: 'xName',
    description: '',
    propertyType: {
      id: '490724b7-2a7d-42ba-b61e-27128e8b0f32',
      type: 'type',
      name: 'string',
      fullyQualifiedName: 'string',
      description: '"A String type."',
      displayName: 'string',
      href: 'http://localhost:8585/api/v1/metadata/types/490724b7-2a7d-42ba-b61e-27128e8b0f32',
    },
  },
];

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./PropertyValue', () => ({
  PropertyValue: jest.fn().mockReturnValue(<div>PropertyValue</div>),
}));

jest.mock('../ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
});

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn().mockReturnValue({
    data: {},
    onUpdate: jest.fn(),
    filterWidgets: jest.fn(),
  }),
}));

jest.mock('../../../rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      customProperties: mockCustomProperties,
    })
  ),
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockReturnValue({
    getEntityPermissionByFqn: jest.fn().mockReturnValue({
      Create: true,
      Delete: true,
      ViewAll: true,
      EditAll: true,
      EditDescription: true,
      EditDisplayName: true,
      EditCustomFields: true,
    }),
  }),
}));
jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Skeleton: jest.fn().mockImplementation(() => <div>Skeleton.loader</div>),
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: jest.fn().mockImplementation(() => ({
    fqn: 'fqn',
  })),
}));

const handleExtensionUpdate = jest.fn();

const mockProp = {
  handleExtensionUpdate,
  entityType: EntityType.TABLE,
  hasEditAccess: true,
  hasPermission: true,
  entityDetails: {
    id: '0e84330a',
    name: 'cypr081639',
    fullyQualifiedName: 'cy-da-1705598081639',
    tags: [],
    version: 0.1,
    updatedAt: 1705,
    updatedBy: 'admin',
    href: 'http://localhost:8585/api/v1/databases/',
    service: {
      id: '420df68ba',
      type: 'databaseService',
      name: 'cy-da348',
      fullyQualifiedName: 'cy3348',
      deleted: false,
      href: 'http://localhost:8585/api/v1/services/dat83b567868ba',
    },
    serviceType: 'Mysql',
    default: false,
    deleted: false,
    columns: [],
    votes: {
      upVotes: 0,
      downVotes: 0,
      upVoters: [],
      downVoters: [],
    },
  } as Table,
};

describe('Test CustomProperty Table Component', () => {
  it("Should render permission placeholder if doesn't have permission", async () => {
    await act(async () => {
      render(
        <CustomPropertyTable
          {...mockProp}
          entityType={EntityType.TABLE}
          hasPermission={false}
        />
      );
    });
    const permissionPlaceholder = await screen.findByText(
      'ErrorPlaceHolder.component'
    );

    expect(permissionPlaceholder).toBeInTheDocument();
  });

  it('Should render table component', async () => {
    await act(async () => {
      render(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });
    const table = await screen.findByTestId('custom-properties-card');

    expect(table).toBeInTheDocument();

    const propertyValue = await screen.findByText('PropertyValue');

    expect(propertyValue).toBeInTheDocument();
  });

  it('Should render no data placeholder if custom properties list is empty', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: [] })
    );
    await act(async () => {
      render(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });
    const noDataPlaceHolder = await screen.findByText(
      'ErrorPlaceHolder.component'
    );

    expect(noDataPlaceHolder).toBeInTheDocument();
  });

  it('Should not render no data placeholder if custom properties list is empty and isRenderedInRightPanel', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: [] })
    );
    await act(async () => {
      render(
        <CustomPropertyTable
          {...mockProp}
          isRenderedInRightPanel
          entityType={EntityType.TABLE}
        />
      );
    });

    expect(screen.queryByText('ErrorPlaceHolder.component')).toBeNull();
  });

  it('Loader should be shown while loading the custom properties', async () => {
    (getTypeByFQN as jest.Mock).mockResolvedValueOnce(Promise.resolve({}));
    render(<CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />);

    // To check if loader was rendered when the loading state was true and then removed after loading is false
    await waitForElementToBeRemoved(() => screen.getByText('Skeleton.loader'));

    const noDataPlaceHolder = await screen.findByText(
      'ErrorPlaceHolder.component'
    );

    expect(noDataPlaceHolder).toBeInTheDocument();
  });

  it('Should render custom property data if custom properties list is not empty', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: mockCustomProperties })
    );
    await act(async () => {
      render(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });

    const tableRowValue = await screen.findByText('PropertyValue');

    expect(tableRowValue).toBeInTheDocument();
  });
});
