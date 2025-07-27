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
import { act, render, screen, waitFor } from '@testing-library/react';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { mockEntityPermissions } from '../../pages/DatabaseSchemaPage/mocks/DatabaseSchemaPage.mock';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import {
  getListTestCaseBySearch,
  getTestSuiteByName,
  updateTestSuiteById,
} from '../../rest/testAPI';
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
jest.mock('../../hooks/useApplicationStore', () => {
  return {
    useApplicationStore: jest
      .fn()
      .mockImplementation(() => ({ isAuthDisabled: true })),
  };
});
const mockLocationPathname = '/mock-path';
jest.mock('react-router-dom', () => {
  return {
    useNavigate: jest.fn().mockReturnValue(jest.fn()),
  };
});

jest.mock('../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockImplementation(() => ({
    fqn: 'testSuiteFQN',
  })),
}));

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => ({
    pathname: mockLocationPathname,
  }),
}));

jest.mock('../../rest/testAPI', () => {
  return {
    getTestSuiteByName: jest.fn().mockImplementation(() => Promise.resolve()),
    updateTestSuiteById: jest.fn().mockImplementation(() => Promise.resolve()),
    addTestCaseToLogicalTestSuite: jest
      .fn()
      .mockImplementation(() => Promise.resolve()),
    getListTestCaseBySearch: jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: [], paging: { total: 0 } })
      ),
    ListTestCaseParamsBySearch: jest
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
jest.mock(
  '../../components/Entity/EntityHeaderTitle/EntityHeaderTitle.component',
  () => {
    return jest
      .fn()
      .mockImplementation(() => <div>EntityHeaderTitle.component</div>);
  }
);
jest.mock('../../components/common/DomainLabel/DomainLabel.component', () => {
  return {
    DomainLabel: jest
      .fn()
      .mockImplementation(() => <div>DomainLabel.component</div>),
  };
});
jest.mock('../../rest/ingestionPipelineAPI', () => ({
  getIngestionPipelines: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: [],
      paging: { total: 0 },
    })
  ),
}));
jest.mock('../../components/common/OwnerLabel/OwnerLabel.component', () => ({
  OwnerLabel: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="owner-label">OwnerLabel.component</div>
    )),
}));
jest.mock('../../components/common/TabsLabel/TabsLabel.component', () => {
  return jest.fn().mockImplementation(({ id, name }) => (
    <div className="w-full tabs-label-container" data-testid={id}>
      <div className="d-flex justify-between gap-2">{name}</div>
    </div>
  ));
});

describe('TestSuiteDetailsPage component', () => {
  it('component should render', async () => {
    render(<TestSuiteDetailsPage />);

    expect(
      await screen.findByText('TitleBreadcrumb.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('EntityHeaderTitle.component')
    ).toBeInTheDocument();
    expect(
      await screen.findByText('DomainLabel.component')
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
      fields: ['owners', 'domains'],
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

  it('should handle domain update', async () => {
    const mockUpdateTestSuite = jest.fn().mockResolvedValue({
      id: '123',
      name: 'test-suite',
      domain: { id: 'domain-id', name: 'domain-name', type: 'domain' },
    });

    (updateTestSuiteById as jest.Mock).mockImplementationOnce(
      mockUpdateTestSuite
    );

    await act(async () => {
      render(<TestSuiteDetailsPage />);
    });

    expect(
      await screen.findByText('DomainLabel.component')
    ).toBeInTheDocument();
  });

  it('should handle description update', async () => {
    const mockUpdateTestSuite = jest.fn().mockResolvedValue({
      id: '123',
      name: 'test-suite',
      description: 'Updated description',
    });

    (updateTestSuiteById as jest.Mock).mockImplementationOnce(
      mockUpdateTestSuite
    );

    await act(async () => {
      render(<TestSuiteDetailsPage />);
    });

    expect(
      await screen.findByText('Description.component')
    ).toBeInTheDocument();
  });

  it('should handle test case pagination', async () => {
    const mockGetListTestCase = jest.fn().mockResolvedValue({
      data: [],
      paging: { total: 10 },
    });

    (getListTestCaseBySearch as jest.Mock).mockImplementationOnce(
      mockGetListTestCase
    );

    (getTestSuiteByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        id: 'test-suite-id',
        name: 'test-suite',
      })
    );

    await act(async () => {
      render(<TestSuiteDetailsPage />);
    });

    await screen.findByTestId('test-cases');

    expect(mockGetListTestCase).toHaveBeenCalledWith(
      expect.objectContaining({
        fields: ['testCaseResult', 'testDefinition', 'testSuite', 'incidentId'],
        testSuiteId: 'test-suite-id',
      })
    );
  });

  it('should handle add test case modal', async () => {
    await act(async () => {
      render(<TestSuiteDetailsPage />);
    });

    const addButton = await screen.findByTestId('add-test-case-btn');

    expect(addButton).toBeInTheDocument();

    await act(async () => {
      addButton.click();
    });

    // Modal should be visible after clicking add button
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('should handle ingestion pipeline count', async () => {
    const mockGetIngestionPipelines = getIngestionPipelines as jest.Mock;
    mockGetIngestionPipelines.mockImplementationOnce(() =>
      Promise.resolve({
        data: [],
        paging: { total: 5 },
        total: 5,
      })
    );

    (getTestSuiteByName as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        id: 'test-suite-id',
        name: 'test-suite',
        fullyQualifiedName: 'testSuiteFQN',
      })
    );

    render(<TestSuiteDetailsPage />);

    await waitFor(() =>
      expect(mockGetIngestionPipelines).toHaveBeenCalledWith(
        expect.objectContaining({
          testSuite: 'testSuiteFQN',
          pipelineType: ['TestSuite'],
          arrQueryFields: [],
          limit: 0,
        })
      )
    );
  });
});
