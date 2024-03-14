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
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { mockEntityPermissions } from '../../pages/DatabaseSchemaPage/mocks/DatabaseSchemaPage.mock';
import { getTestSuiteByName } from '../../rest/testAPI';
import TestSuiteDetailsPage from './TestSuiteDetailsPage.component';

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () => {
  return jest.fn().mockImplementation(({ children }) => <div>{children}</div>);
});
jest.mock('../../components/common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader.component</div>);
});
jest.mock(
  '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>TitleBreadcrumb.component</div>);
  }
);
jest.mock(
  '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ErrorPlaceHolder.component</div>);
  }
);
jest.mock(
  '../../components/common/EntitySummaryDetails/EntitySummaryDetails',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>EntitySummaryDetails.component</div>);
  }
);
jest.mock(
  '../../components/common/EntityPageInfos/ManageButton/ManageButton',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>ManageButton.component</div>);
  }
);
jest.mock('../../components/common/EntityDescription/DescriptionV1', () => {
  return jest.fn().mockImplementation(() => <div>Description.component</div>);
});
jest.mock(
  '../../components/Database/Profiler/DataQualityTab/DataQualityTab',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>DataQualityTab.component</div>);
  }
);
jest.mock('../../components/Auth/AuthProviders/AuthProvider', () => {
  return {
    useAuthContext: jest
      .fn()
      .mockImplementation(() => ({ isAuthDisabled: true })),
  };
});
jest.mock('../../hooks/authHooks', () => {
  return {
    useAuth: jest.fn().mockImplementation(() => ({ isAdminUser: true })),
  };
});
jest.mock('react-router-dom', () => {
  return {
    useHistory: jest.fn().mockImplementation(() => ({ push: jest.fn() })),
    useParams: jest.fn().mockImplementation(() => ({ fqn: 'testSuiteFQN' })),
  };
});
jest.mock('../../rest/testAPI', () => {
  return {
    getTestSuiteByName: jest.fn().mockImplementation(() => Promise.resolve()),
    updateTestSuiteById: jest.fn().mockImplementation(() => Promise.resolve()),
    addTestCaseToLogicalTestSuite: jest
      .fn()
      .mockImplementation(() => Promise.resolve()),
    getListTestCase: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: [] })),
    ListTestCaseParams: jest
      .fn()
      .mockImplementation(() => Promise.resolve({ data: [] })),
  };
});
jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: jest.fn().mockImplementation(() => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => Promise.resolve(mockEntityPermissions)),
  })),
}));

describe('TestSuiteDetailsPage component', () => {
  it('component should render', async () => {
    render(<TestSuiteDetailsPage />);

    expect(
      await screen.findByText('TitleBreadcrumb.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('ManageButton.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Description.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('DataQualityTab.component')
    ).toBeInTheDocument();
    expect(await screen.findByTestId('add-test-case-btn')).toBeInTheDocument();
  });

  it('should call test suite API on page load', async () => {
    const mockGetTestSuiteByName = getTestSuiteByName as jest.Mock;
    await act(async () => {
      render(<TestSuiteDetailsPage />);
    });

    expect(mockGetTestSuiteByName).toHaveBeenCalledWith('testSuiteFQN', {
      fields: 'owner',
      include: 'all',
    });
  });

  it('should show no permission error if there is no permission', async () => {
    (usePermissionProvider as jest.Mock).mockImplementationOnce(() => ({
      getEntityPermissionByFqn: jest.fn().mockImplementation(() =>
        Promise.resolve({
          ...mockEntityPermissions,
          ViewAll: false,
          ViewBasic: false,
        })
      ),
    }));

    await act(async () => {
      render(<TestSuiteDetailsPage />);
    });

    expect(
      await screen.findByText('ErrorPlaceHolder.component')
    ).toBeInTheDocument();
  });
});
