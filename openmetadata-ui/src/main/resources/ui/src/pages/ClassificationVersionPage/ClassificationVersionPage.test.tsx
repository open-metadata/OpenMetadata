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
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import {
  getClassificationByName,
  getClassificationVersionData,
  getClassificationVersionsList,
} from '../../rest/tagAPI';
import { MOCK_ALL_CLASSIFICATIONS } from '../TagsPage/TagsPage.mock';
import ClassificationVersionPage from './ClassificationVersionPage';

const mockParams = {
  fqn: 'PersonalData',
  version: '0.1',
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
  })),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock(
  '../../components/Classifications/ClassificationDetails/ClassificationDetails',
  () => {
    return jest.fn().mockImplementation(() => (
      <div>
        <div>ClassificationDetails</div>
        <div data-testid="asset-description-container">Test Description</div>
        <div>Domain</div>
        <div data-testid="classification-owner-name">Owner</div>
      </div>
    ));
  }
);

jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest.fn().mockReturnValue(<div>testErrorPlaceHolder</div>);
  }
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () => {
    return jest.fn().mockReturnValue(<div>testEntityVersionTimeLine</div>);
  }
);

jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader component</div>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

const mockGetEntityPermissionByFqn = jest
  .fn()
  .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS));

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: mockGetEntityPermissionByFqn,
  })),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  DEFAULT_ENTITY_PERMISSION: {
    ViewAll: true,
    ViewBasic: true,
  },
}));

const mockClassification = { id: 123 };

jest.mock('../../rest/tagAPI', () => ({
  getClassificationByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockClassification)),
  getClassificationVersionData: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(MOCK_ALL_CLASSIFICATIONS.data[0])
    ),
  getClassificationVersionsList: jest.fn().mockImplementation(() =>
    Promise.resolve([
      {
        entityType: 'classification',
        versions: [],
      },
    ])
  ),
}));

jest.mock('../../utils/RouterUtils', () => ({
  getClassificationVersionsPath: jest.fn(),
  getClassificationDetailsPath: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

describe('ClassificationVersionPage component', () => {
  it('should render Loader', async () => {
    render(<ClassificationVersionPage />, {
      wrapper: MemoryRouter,
    });

    const loader = screen.getByText('Loader component');

    expect(loader).toBeInTheDocument();
  });

  it('should render EntityVersionTimeLine', async () => {
    await act(async () => {
      render(<ClassificationVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    const versionData = await screen.findByTestId('version-data');
    const entityVersionTimeLine = await screen.findByText(
      'testEntityVersionTimeLine'
    );

    expect(versionData).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
  });

  it('should renders ErrorPlaceHolder with permission error', async () => {
    mockGetEntityPermissionByFqn.mockResolvedValueOnce({});
    render(<ClassificationVersionPage />, {
      wrapper: MemoryRouter,
    });

    const errorPlaceholder = await screen.findByText('testErrorPlaceHolder');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('should renders ClassificationDetails in version view with all permissions', async () => {
    await act(async () => {
      render(<ClassificationVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(mockGetEntityPermissionByFqn).toHaveBeenCalledWith(
      'classification',
      mockParams.fqn
    );

    expect(getClassificationByName).toHaveBeenCalledWith(mockParams.fqn);
    expect(getClassificationVersionsList).toHaveBeenCalledWith(123);

    expect(getClassificationVersionData).toHaveBeenCalledWith(123, '0.1');

    expect(
      await screen.findByText('ClassificationDetails')
    ).toBeInTheDocument();
  });

  it('should render ClassificationVersionPage with PageLayoutV1 and child components', async () => {
    await act(async () => {
      render(<ClassificationVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(PageLayoutV1).toHaveBeenCalled();
    expect((PageLayoutV1 as jest.Mock).mock.calls[0][0].className).toBe(
      'version-page-container'
    );
    expect((PageLayoutV1 as jest.Mock).mock.calls[0][0].pageTitle).toBe(
      'label.entity-version-detail-plural'
    );
  });

  it('should not render edit permissions in version view', async () => {
    await act(async () => {
      render(<ClassificationVersionPage />, {
        wrapper: MemoryRouter,
      });
    });

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();

    expect(screen.queryByTestId('add-domain')).not.toBeInTheDocument();

    expect(screen.queryByTestId('add-owner')).not.toBeInTheDocument();
  });
});
