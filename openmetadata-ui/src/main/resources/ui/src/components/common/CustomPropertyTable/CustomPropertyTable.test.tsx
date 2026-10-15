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
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { Team } from '../../../generated/entity/teams/team';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { renderWithQueryClient } from '../../../test/unit/test-utils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
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

jest.mock('../ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
});

jest.mock('../EmptyPlaceholder/CreatePlaceholder', () => {
  return jest.fn().mockReturnValue(<div>CreatePlaceholder.component</div>);
});

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  ...jest.requireActual('../../Customization/GenericProvider/GenericContext'),
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
      ViewCustomFields: true,
    }),
  }),
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
};

describe('Test CustomProperty Table Component', () => {
  beforeEach(() => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: {},
      onUpdate: jest.fn(),
      filterWidgets: jest.fn(),
    });
  });

  it("Should render permission placeholder if doesn't have permission", async () => {
    await act(async () => {
      renderWithQueryClient(
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
      renderWithQueryClient(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });
    const table = await screen.findByTestId('custom-properties-card');

    expect(table).toBeInTheDocument();
    expect(
      await screen.findByTestId('custom-property-xName-card')
    ).toBeInTheDocument();
  });

  it('Should render read-only property rows in version view', async () => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { extension: { xName: 'Data Platform' } },
      onUpdate: jest.fn(),
      filterWidgets: jest.fn(),
    });

    await act(async () => {
      renderWithQueryClient(
        <CustomPropertyTable
          {...mockProp}
          isVersionView
          entityType={EntityType.TABLE}
        />
      );
    });

    const row = await screen.findByTestId('custom-property-xName-row');

    expect(within(row).getByTestId('property-value')).toHaveTextContent(
      'Data Platform'
    );
    expect(screen.queryByTestId('edit-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('add-value-button')).not.toBeInTheDocument();
  });

  it('Should save an edited value as the merged entity extension', async () => {
    const onUpdate = jest.fn().mockResolvedValue(undefined);
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { id: 'table-id', extension: { other: 'kept' } },
      onUpdate,
      filterWidgets: jest.fn(),
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await act(async () => {
      renderWithQueryClient(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });

    await user.click(await screen.findByTestId('add-value-button'));
    await user.type(screen.getByTestId('value-input'), 'Data Platform{Enter}');

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        {
          id: 'table-id',
          extension: { other: 'kept', xName: 'Data Platform' },
        },
        'extension'
      )
    );
  });

  it('Should render no data placeholder if custom properties list is empty', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: [] })
    );
    await act(async () => {
      renderWithQueryClient(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });
    const noDataPlaceHolder = await screen.findByText(
      'CreatePlaceholder.component'
    );

    expect(noDataPlaceHolder).toBeInTheDocument();
  });

  it('Should not render no data placeholder if custom properties list is empty and isRenderedInRightPanel', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: [] })
    );
    await act(async () => {
      renderWithQueryClient(
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
    renderWithQueryClient(
      <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
    );

    // To check if loader was rendered when the loading state was true and then removed after loading is false
    await waitForElementToBeRemoved(() =>
      screen.getByTestId('custom-property-table-loader')
    );

    const noDataPlaceHolder = await screen.findByText(
      'CreatePlaceholder.component'
    );

    expect(noDataPlaceHolder).toBeInTheDocument();
  });

  it('Should render custom property data if custom properties list is not empty', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: mockCustomProperties })
    );
    await act(async () => {
      renderWithQueryClient(
        <CustomPropertyTable {...mockProp} entityType={EntityType.TABLE} />
      );
    });

    expect(await screen.findByTestId('property-name')).toHaveTextContent(
      'xName'
    );
  });
});

describe('Test CustomProperty Table entity source', () => {
  // Team and user detail pages sit outside the customizable-page system, so they hand the
  // entity in as a prop instead of through a GenericProvider.
  const teamFromProp = {
    id: 'team-id',
    name: 'engineering',
    fullyQualifiedName: 'engineering',
    extension: { xName: 'from-prop' },
  } as Team;

  const contextOnUpdate = jest.fn();

  // jest.config sets clearMocks, so only the context override has to be re-applied here.
  beforeEach(() => {
    (useGenericContext as jest.Mock).mockReturnValue({
      data: { extension: { xName: 'from-context' } },
      onUpdate: contextOnUpdate,
      filterWidgets: jest.fn(),
    });
  });

  const renderWithProps = async (
    props: Partial<Parameters<typeof CustomPropertyTable>[0]> = {}
  ) => {
    await act(async () => {
      renderWithQueryClient(
        <CustomPropertyTable
          hasEditAccess
          hasPermission
          entityType={EntityType.TEAM}
          {...props}
        />
      );
    });
  };

  it('reads the entity from the entityDetails prop when one is given', async () => {
    await renderWithProps({ entityDetails: teamFromProp });

    expect(await screen.findByTestId('property-value')).toHaveTextContent(
      'from-prop'
    );
  });

  it('falls back to the generic context when no entityDetails prop is given', async () => {
    await renderWithProps();

    expect(await screen.findByTestId('property-value')).toHaveTextContent(
      'from-context'
    );
  });

  it('sends extension edits to onEntityUpdate instead of the context handler', async () => {
    const onEntityUpdate = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderWithProps({
      entityDetails: { ...teamFromProp, extension: { other: 'kept' } } as Team,
      onEntityUpdate,
    });

    await user.click(await screen.findByTestId('add-value-button'));
    await user.type(screen.getByTestId('value-input'), 'edited{Enter}');

    await waitFor(() =>
      expect(onEntityUpdate).toHaveBeenCalledWith(
        {
          ...teamFromProp,
          extension: { other: 'kept', xName: 'edited' },
        },
        'extension'
      )
    );

    expect(contextOnUpdate).not.toHaveBeenCalled();
  });

  it('looks up the property definitions for the team entity type', async () => {
    await renderWithProps({ entityDetails: teamFromProp });

    expect(getTypeByFQN).toHaveBeenCalledWith(EntityType.TEAM);
  });
});
