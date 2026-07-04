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
import { renderHook, waitFor } from '@testing-library/react';
import { TestCase } from '../../../../generated/tests/testCase';
import { act } from 'react';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { MOCK_TEST_CASE_DATA } from '../../../../mocks/TestCase.mock';
import {
  getTestDefinitionById,
  updateTestCaseById,
} from '../../../../rest/testAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { showSuccessToast } from '../../../../utils/ToastUtils';
import { useTestCaseResultTab } from './useTestCaseResultTab';

const mockSetTestCase = jest.fn();

const mockUseTestCaseStore = {
  testCase: MOCK_TEST_CASE_DATA as unknown as TestCase,
  setTestCase: mockSetTestCase,
  showAILearningBanner: false,
  testCasePermission: MOCK_PERMISSIONS,
  isTabExpanded: true,
};

jest.mock(
  '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store',
  () => ({
    useTestCaseStore: jest.fn().mockImplementation(() => mockUseTestCaseStore),
  })
);

jest.mock('../../../../rest/testAPI', () => ({
  getTestDefinitionById: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve({ supportsRowLevelPassedFailed: true })
    ),
  updateTestCaseById: jest
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        jest.requireActual('../../../../mocks/TestCase.mock')
          .MOCK_TEST_CASE_DATA
      )
    ),
}));

jest.mock('./TestCaseResultTabClassBase', () => ({
  __esModule: true,
  default: {
    getAdditionalComponents: jest.fn().mockReturnValue([]),
    getAlertBanner: jest.fn().mockReturnValue(null),
  },
}));

let mockParams: Record<string, string | undefined> = {};

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => mockParams),
}));

const mockRefetchChangeSummary = jest.fn();

jest.mock('../../../../hooks/useChangeSummary', () => ({
  useChangeSummary: jest.fn().mockImplementation(() => ({
    changeSummary: {
      description: {
        changedAt: 1700000000000,
        changedBy: 'teddy',
        changeSource: 'Manual',
      },
    },
    isLoading: false,
    refetch: mockRefetchChangeSummary,
  })),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('useTestCaseResultTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockUseTestCaseStore.testCase = MOCK_TEST_CASE_DATA as unknown as TestCase;
    mockUseTestCaseStore.testCasePermission = MOCK_PERMISSIONS;
  });

  it('should expose the test case from the store and split parameters', () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.testCase).toEqual(MOCK_TEST_CASE_DATA);
    expect(result.current.isVersionPage).toBe(false);
    expect(result.current.withoutSqlParams).toHaveLength(2);
    expect(result.current.withSqlParams).toHaveLength(0);
    expect(result.current.description).toBe(MOCK_TEST_CASE_DATA.description);
  });

  it('should split out the sqlExpression parameter', () => {
    mockUseTestCaseStore.testCase = {
      ...MOCK_TEST_CASE_DATA,
      parameterValues: [
        ...(MOCK_TEST_CASE_DATA.parameterValues ?? []),
        { name: 'sqlExpression', value: 'SELECT 1' },
      ],
    };

    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.withSqlParams).toHaveLength(1);
    expect(result.current.withoutSqlParams).toHaveLength(2);
  });

  it('should derive edit permissions from the store permission', () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.hasEditPermission).toBe(true);
    expect(result.current.hasEditDescriptionPermission).toBe(true);
    expect(result.current.hasEditTagsPermission).toBe(true);
    expect(result.current.hasEditGlossaryTermsPermission).toBe(true);
  });

  it('should disable edit permissions without permission', () => {
    mockUseTestCaseStore.testCasePermission = DEFAULT_ENTITY_PERMISSION;

    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.hasEditPermission).toBeFalsy();
    expect(result.current.hasEditDescriptionPermission).toBeFalsy();
  });

  it('should disable edit permissions on version pages', () => {
    mockParams = { version: '0.2' };

    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.isVersionPage).toBe(true);
    expect(result.current.hasEditPermission).toBe(false);
    expect(result.current.hasEditTagsPermission).toBe(false);
    expect(result.current.parameterItems).toBeNull();
  });

  it('should build parameter items with compute row count when supported', async () => {
    mockUseTestCaseStore.testCase = {
      ...MOCK_TEST_CASE_DATA,
      computePassedFailedRowCount: true,
    };

    const { result } = renderHook(() => useTestCaseResultTab());

    await waitFor(() => expect(result.current.showComputeRowCount).toBe(true));

    expect(getTestDefinitionById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.testDefinition.id
    );
    expect(result.current.parameterItems).toHaveLength(3);
  });

  it('should build a dynamic assertion parameter item', () => {
    mockUseTestCaseStore.testCase = {
      ...MOCK_TEST_CASE_DATA,
      useDynamicAssertion: true,
    };

    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.parameterItems).toHaveLength(1);
    expect(result.current.parameterItems?.[0].label).toBeUndefined();
  });

  it('handleDescriptionChange should patch the description and toast success', async () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    await act(async () => {
      await result.current.handleDescriptionChange('updated description');
    });

    expect(updateTestCaseById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.id,
      expect.arrayContaining([
        expect.objectContaining({ path: '/description' }),
      ])
    );
    expect(mockSetTestCase).toHaveBeenCalled();
    expect(showSuccessToast).toHaveBeenCalled();
    expect(mockRefetchChangeSummary).toHaveBeenCalled();
  });

  it('should expose the description change summary entry', () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.descriptionChangeSummaryEntry).toEqual({
      changedAt: 1700000000000,
      changedBy: 'teddy',
      changeSource: 'Manual',
    });
  });

  it('handleTagSelection should patch the tags', async () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    await act(async () => {
      await result.current.handleTagSelection([
        { tagFQN: 'PII.Sensitive', source: 'Classification' },
      ]);
    });

    expect(updateTestCaseById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.id,
      expect.arrayContaining([expect.objectContaining({ path: '/tags' })])
    );
    expect(mockSetTestCase).toHaveBeenCalled();
  });

  it('handleDataProductsSave should patch the data products', async () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    await act(async () => {
      await result.current.handleDataProductsSave([
        { id: 'dp-id', name: 'dp-name' } as never,
      ]);
    });

    expect(updateTestCaseById).toHaveBeenCalledWith(
      MOCK_TEST_CASE_DATA.id,
      expect.arrayContaining([
        expect.objectContaining({ path: '/dataProducts' }),
      ])
    );
  });

  it('should toggle the parameter edit state', () => {
    const { result } = renderHook(() => useTestCaseResultTab());

    expect(result.current.isParameterEdit).toBe(false);

    act(() => {
      result.current.setIsParameterEdit(true);
    });

    expect(result.current.isParameterEdit).toBe(true);

    act(() => {
      result.current.handleCancelParameter();
    });

    expect(result.current.isParameterEdit).toBe(false);
  });
});
