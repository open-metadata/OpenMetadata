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
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useTranslation } from 'react-i18next';
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

jest.mock('react-awesome-query-builder', () => ({
  Builder: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="query-builder">Query Builder</div>
    )),
  Query: jest.fn().mockImplementation(({ children, onChange }) => (
    <div data-testid="query-component">
      {children}
      <button onClick={() => onChange && onChange({}, {})}>Change Query</button>
    </div>
  )),
  Utils: {
    checkTree: jest.fn(),
    loadTree: jest.fn(),
  },
}));

jest.mock('../../../../../utils/CuratedAssetsUtils', () => ({
  AlertMessage: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="alert-message">Alert Message</div>
    )),
  APP_CONFIG_PATH: ['sourceConfig', 'config', 'appConfig'],
  getExploreURLWithFilters: jest.fn().mockReturnValue('test-url'),
  getModifiedQueryFilterWithSelectedAssets: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../../utils/QueryBuilderElasticsearchFormatUtils', () => ({
  elasticSearchFormat: jest.fn().mockReturnValue({}),
}));

jest.mock('../../../../../utils/QueryBuilderUtils', () => ({
  getJsonTreeFromQueryFilter: jest.fn().mockReturnValue({}),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Form: {
    useFormInstance: jest.fn().mockReturnValue({
      getFieldValue: jest.fn().mockReturnValue('{}'),
      setFieldValue: jest.fn(),
    }),
    useWatch: jest.fn().mockReturnValue([]),
    Item: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  },
  Col: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Row: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
  Input: jest
    .fn()
    .mockImplementation(() => <input data-testid="hidden-input" />),
  Skeleton: jest
    .fn()
    .mockImplementation(() => <div data-testid="skeleton">Skeleton</div>),
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
    render(<AdvancedAssetsFilterField {...defaultProps} />);

    expect(screen.getByText('label.advance-filter')).toBeInTheDocument();
  });

  it('renders query builder component', () => {
    render(<AdvancedAssetsFilterField {...defaultProps} />);

    expect(screen.getByTestId('query-component')).toBeInTheDocument();
    expect(screen.getByTestId('query-builder')).toBeInTheDocument();
  });

  it('displays resource count when available', () => {
    const propsWithCount = {
      ...defaultProps,
      selectedAssetsInfo: {
        ...mockSelectedAssetsInfo,
        filteredResourceCount: 5,
      },
    };

    render(<AdvancedAssetsFilterField {...propsWithCount} />);

    expect(
      screen.getByTestId('automator-conditions-container')
    ).toBeInTheDocument();
  });

  it('handles query changes correctly', () => {
    render(<AdvancedAssetsFilterField {...defaultProps} />);

    const changeButton = screen.getByText('Change Query');
    fireEvent.click(changeButton);

    expect(screen.getByTestId('query-component')).toBeInTheDocument();
  });

  it('renders skeleton when loading', () => {
    const propsWithLoading = {
      ...defaultProps,
      selectedAssetsInfo: {
        ...mockSelectedAssetsInfo,
        isCountLoading: true,
      },
    };

    render(<AdvancedAssetsFilterField {...propsWithLoading} />);

    expect(
      screen.getByTestId('automator-conditions-container')
    ).toBeInTheDocument();
  });

  it('renders hidden form field for query filter', () => {
    render(<AdvancedAssetsFilterField {...defaultProps} />);

    expect(
      screen.getByTestId('automator-conditions-container')
    ).toBeInTheDocument();
  });
});
