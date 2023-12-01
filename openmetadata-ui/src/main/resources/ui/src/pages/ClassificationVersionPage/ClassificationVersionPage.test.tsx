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
import ClassificationDetails from '../../components/ClassificationDetails/ClassificationDetails';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { ENTITY_PERMISSIONS } from '../../mocks/Permissions.mock';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { MOCK_ALL_CLASSIFICATIONS } from '../TagsPage/TagsPage.mock';
import ClassificationVersionPage from './ClassificationVersionPage';

const mockParams = {
  fqn: 'table',
  version: '0.1',
};

const mockedUsePermissionProvider = usePermissionProvider as jest.Mock;

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
  })),
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

jest.mock(
  '../../components/ClassificationDetails/ClassificationDetails',
  () => {
    return jest.fn().mockReturnValue(<div>testClassificationDetails</div>);
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

jest.mock('../../components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div>Loader component</div>);
});

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../../components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve(ENTITY_PERMISSIONS)),
  })),
}));

jest.mock('../../utils/PermissionsUtils', () => ({
  checkPermission: jest.fn().mockReturnValue(true),
  DEFAULT_ENTITY_PERMISSION: {
    ViewAll: true,
    ViewBasic: true,
  },
}));

jest.mock('../../rest/tagAPI', () => ({
  getClassificationByName: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_ALL_CLASSIFICATIONS)),
  getClassificationVersionData: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_ALL_CLASSIFICATIONS)),
  getClassificationVersionsList: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_ALL_CLASSIFICATIONS)),
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
    mockedUsePermissionProvider.mockReturnValue({
      getEntityPermissionByFqn: jest.fn().mockResolvedValue({}),
    });

    render(<ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />, {
      wrapper: MemoryRouter,
    });

    const errorPlaceholder = await screen.findByText('testErrorPlaceHolder');

    expect(errorPlaceholder).toBeInTheDocument();
  });

  it('should renders ClassificationDetails in version view with all permissions', () => {
    const currentVersionData = {
      description: 'description',
      name: 'advanceSearch',
    };

    render(
      <ClassificationDetails
        isVersionView
        classificationPermissions={DEFAULT_ENTITY_PERMISSION}
        currentClassification={currentVersionData}
      />
    );

    const classificationName = screen.getByText('testClassificationDetails');

    expect(classificationName).toBeInTheDocument();
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
});
