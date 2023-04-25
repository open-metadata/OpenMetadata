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
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { getContainerByName } from 'rest/storageAPI';
import ContainerPage from './ContainerPage';
import { CONTAINER_DATA } from './ContainerPage.mock';

jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest.fn().mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
      EditCustomFields: true,
      EditDataProfile: true,
      EditDescription: true,
      EditDisplayName: true,
      EditLineage: true,
      EditOwner: true,
      EditQueries: true,
      EditSampleData: true,
      EditTags: true,
      EditTests: true,
      EditTier: true,
      ViewAll: true,
      ViewDataProfile: true,
      ViewQueries: true,
      ViewSampleData: true,
      ViewTests: true,
      ViewUsage: true,
    }),
  })),
}));

jest.mock('components/common/CustomPropertyTable/CustomPropertyTable', () => {
  return {
    CustomPropertyTable: jest
      .fn()
      .mockReturnValue(
        <div data-testid="custom-properties-table">CustomPropertyTable</div>
      ),
  };
});

jest.mock('components/common/description/Description', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="description">Description</div>);
});

jest.mock('components/common/entityPageInfo/EntityPageInfo', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="entity-page-info">EntityPageInfo</div>);
});

jest.mock('components/common/error-with-placeholder/ErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="error-placeholder">ErrorPlaceHolder</div>
    );
});

jest.mock(
  'components/ContainerDetail/ContainerChildren/ContainerChildren',
  () => {
    return jest
      .fn()
      .mockReturnValue(
        <div data-testid="containers-children">ContainerChildren</div>
      );
  }
);

jest.mock(
  'components/ContainerDetail/ContainerDataModel/ContainerDataModel',
  () => {
    return jest
      .fn()
      .mockReturnValue(
        <div data-testid="container-data-model">ContainerDataModel</div>
      );
  }
);

jest.mock('components/containers/PageContainerV1', () => {
  return jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="container-children">{children}</div>
    ));
});

jest.mock('components/EntityLineage/EntityLineage.component', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="entity-lineage">EntityLineage</div>);
});

jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('rest/lineageAPI', () => ({
  getLineageByFQN: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/miscAPI', () => ({
  deleteLineageEdge: jest.fn().mockImplementation(() => Promise.resolve()),
  addLineage: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('rest/storageAPI', () => ({
  addContainerFollower: jest.fn().mockImplementation(() => Promise.resolve()),
  getContainerByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(CONTAINER_DATA)),
  patchContainerDetails: jest.fn().mockImplementation(() => Promise.resolve()),
  removeContainerFollower: jest
    .fn()
    .mockImplementation(() => Promise.resolve()),
  restoreContainer: jest.fn().mockImplementation(() => Promise.resolve()),
}));

let mockParams = {
  entityFQN: 'entityTypeFQN',
  tab: 'schema',
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

describe('Container Page Component', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Should render the child components', async () => {
    await act(async () => {
      render(<ContainerPage />, {
        wrapper: MemoryRouter,
      });
    });

    const pageTopInfo = screen.getByTestId('entity-page-info');
    const tabs = screen.getAllByRole('tab');

    expect(pageTopInfo).toBeInTheDocument();
    expect(tabs).toHaveLength(4);
  });

  it('Should render the schema tab component', async () => {
    await act(async () => {
      render(<ContainerPage />, {
        wrapper: MemoryRouter,
      });
    });
    const tabs = screen.getAllByRole('tab');

    const schemaTab = tabs[0];

    expect(schemaTab).toHaveAttribute('aria-selected', 'true');

    const description = screen.getByTestId('description');

    expect(description).toBeInTheDocument();

    const dataModel = screen.getByTestId('container-data-model');

    expect(dataModel).toBeInTheDocument();
  });

  it('Should render the children tab component', async () => {
    mockParams = { ...mockParams, tab: 'children' };

    await act(async () => {
      render(<ContainerPage />, {
        wrapper: MemoryRouter,
      });
    });

    const containerChildren = screen.getByTestId('containers-children');

    expect(containerChildren).toBeInTheDocument();
  });

  it('Should render the lineage tab component', async () => {
    mockParams = { ...mockParams, tab: 'lineage' };

    await act(async () => {
      render(<ContainerPage />, {
        wrapper: MemoryRouter,
      });
    });

    const lineage = screen.getByTestId('entity-lineage');

    expect(lineage).toBeInTheDocument();
  });

  it('Should render the custom properties tab component', async () => {
    mockParams = { ...mockParams, tab: 'custom-properties' };

    await act(async () => {
      render(<ContainerPage />, {
        wrapper: MemoryRouter,
      });
    });

    const customPropertyTable = screen.getByTestId('custom-properties-table');

    expect(customPropertyTable).toBeInTheDocument();
  });

  it('Should render error placeholder on API fail', async () => {
    mockParams = { ...mockParams, tab: 'schema' };
    (getContainerByName as jest.Mock).mockImplementationOnce(() =>
      Promise.reject()
    );

    await act(async () => {
      render(<ContainerPage />, {
        wrapper: MemoryRouter,
      });
    });

    const errorPlaceholder = screen.getByTestId('error-placeholder');

    expect(errorPlaceholder).toBeInTheDocument();
  });
});
