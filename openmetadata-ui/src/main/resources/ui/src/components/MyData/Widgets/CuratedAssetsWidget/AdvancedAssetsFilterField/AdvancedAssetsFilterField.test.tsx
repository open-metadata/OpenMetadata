/*
 *  Copyright 2025 Collate.
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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useAdvanceSearch } from '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component';
import { CuratedAssetsConfig } from '../CuratedAssetsModal/CuratedAssetsModal.interface';
import { AdvancedAssetsFilterField } from './AdvancedAssetsFilterField.component';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../../../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: '' }),
}));

jest.mock(
  '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockReturnValue({
      config: {},
      treeInternal: {},
      onTreeUpdate: jest.fn(),
      onReset: jest.fn(),
      searchIndex: 1,
    }),
  })
);

// Spread the real module: the config layer reads `BasicConfig` at import time,
// so a mock that only names Query/Builder/Utils breaks module evaluation.
jest.mock('@react-awesome-query-builder/ui', () => ({
  ...jest.requireActual('@react-awesome-query-builder/ui'),
  Utils: {
    ...jest.requireActual('@react-awesome-query-builder/ui').Utils,
    checkTree: jest.fn(),
    loadTree: jest.fn(),
    getTree: jest.fn().mockReturnValue({ id: 'root', type: 'group' }),
  },
}));

// This field now renders the canonical builder, which has its own suite. Here
// the contract is the form value it writes back.
jest.mock('../../../../common/QueryBuilder/QueryBuilder', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ onChange }) => (
    <div data-testid="query-component">
      <button onClick={() => onChange?.('{"query":"changed"}', undefined)}>
        Change Query
      </button>
    </div>
  )),
}));

jest.mock('../../../../../utils/CuratedAssetsPureUtils', () => ({
  getExpandedResourceList: jest.fn().mockReturnValue(['table']),
  getExploreURLForAdvancedFilter: jest.fn().mockReturnValue('test-url'),
  getModifiedQueryFilterWithSelectedAssets: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../../utils/CuratedAssetsUtils', () => ({
  AlertMessage: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="alert-message">Alert Message</div>
    )),
}));

jest.mock('../../../../../utils/QueryBuilderElasticsearchFormatUtils', () => ({
  elasticSearchFormat: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../../utils/QueryBuilderPureUtils', () => ({
  getJsonTreeFromQueryFilter: jest.fn().mockReturnValue({}),
}));

const mockFetchEntityCount = jest.fn();
const mockSelectedAssetsInfo = {
  resourceCount: 0,
  resourcesWithNonZeroCount: [],
};

const defaultProps = {
  fetchEntityCount: mockFetchEntityCount,
  selectedAssetsInfo: mockSelectedAssetsInfo,
};

const QueryFilterValue = () => {
  const queryFilter = useWatch<CuratedAssetsConfig, 'queryFilter'>({
    name: 'queryFilter',
  });

  return <span data-testid="query-filter-value">{queryFilter}</span>;
};

const TestWrapper = ({
  children,
  queryFilter = '{"query":{"bool":{"must":[]}}}',
}: {
  children: ReactNode;
  queryFilter?: string;
}) => {
  const form = useForm<CuratedAssetsConfig>({
    defaultValues: {
      queryFilter,
      resources: ['table'],
      title: 'Test Widget',
    },
  });

  return (
    <FormProvider {...form}>
      {children}
      <QueryFilterValue />
    </FormProvider>
  );
};

describe('AdvancedAssetsFilterField', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders component with correct title', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('label.advance-filter')).toBeInTheDocument();
  });

  it('renders query builder component', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('query-component')).toBeInTheDocument();
  });

  it('displays resource count when available', () => {
    const propsWithCount = {
      ...defaultProps,
      selectedAssetsInfo: {
        ...mockSelectedAssetsInfo,
        filteredResourceCount: 5,
      },
    };

    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...propsWithCount} />
      </TestWrapper>
    );

    expect(screen.getByTestId('advanced-filter-container')).toBeInTheDocument();
  });

  it('handles query changes correctly', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Change Query'));

    expect(screen.getByTestId('query-filter-value')).toHaveTextContent(
      '{"query":"changed"}'
    );
  });

  it('renders skeleton when loading', () => {
    const propsWithLoading = {
      ...defaultProps,
      selectedAssetsInfo: {
        ...mockSelectedAssetsInfo,
        isCountLoading: true,
      },
    };

    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...propsWithLoading} />
      </TestWrapper>
    );

    expect(screen.getByTestId('advanced-filter-container')).toBeInTheDocument();
  });

  it('renders hidden form field for query filter', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('advanced-filter-container')).toBeInTheDocument();
  });

  it('does not show alert message when no filtered resource count', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.queryByTestId('alert-message')).not.toBeInTheDocument();
  });

  it('resets the shared query-builder tree when there is no query filter', () => {
    render(
      <TestWrapper queryFilter="">
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    expect(useAdvanceSearch().onReset).toHaveBeenCalled();
  });

  it('counts the filtered assets for the selected resources', async () => {
    jest.useFakeTimers();
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    jest.useRealTimers();

    expect(mockFetchEntityCount).toHaveBeenCalledWith({
      countKey: 'filteredResourceCount',
      selectedResource: ['table'],
      queryFilter: '{}',
    });
  });
});
