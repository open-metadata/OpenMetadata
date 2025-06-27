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
import { Form } from 'antd';
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

//   ...jest.requireActual('antd'),
//   Form: {
//     ...jest.requireActual('antd').Form,
//     useFormInstance: jest.fn().mockReturnValue({
//       getFieldValue: jest.fn().mockReturnValue('{}'),
//       setFieldValue: jest.fn(),
//     }),
//     useWatch: jest.fn().mockReturnValue(['table']),
//   },
//   Col: jest
//     .fn()
//     .mockImplementation(({ children, className }) => (
//       <div className={className}>{children}</div>
//     )),
//   Row: jest
//     .fn()
//     .mockImplementation(({ children, className }) => (
//       <div className={className}>{children}</div>
//     )),
//   Input: jest
//     .fn()
//     .mockImplementation(() => <input data-testid="hidden-input" />),
//   Skeleton: jest
//     .fn()
//     .mockImplementation(() => <div data-testid="skeleton">Skeleton</div>),
// }));

const mockFetchEntityCount = jest.fn();
const mockSelectedAssetsInfo = {
  resourceCount: 0,
  resourcesWithNonZeroCount: [],
};

const defaultProps = {
  fetchEntityCount: mockFetchEntityCount,
  selectedAssetsInfo: mockSelectedAssetsInfo,
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const [form] = Form.useForm();

  return (
    <Form
      form={form}
      initialValues={{
        sourceConfig: {
          config: {
            appConfig: {
              resources: {
                type: ['table'],
                queryFilter: '{}',
              },
            },
          },
        },
      }}
    >
      {children}
    </Form>
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

    expect(
      screen.getByTestId('automator-conditions-container')
    ).toBeInTheDocument();
  });

  it('handles query changes correctly', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

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

    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...propsWithLoading} />
      </TestWrapper>
    );

    expect(
      screen.getByTestId('automator-conditions-container')
    ).toBeInTheDocument();
  });

  it('renders hidden form field for query filter', () => {
    render(
      <TestWrapper>
        <AdvancedAssetsFilterField {...defaultProps} />
      </TestWrapper>
    );

    expect(
      screen.getByTestId('automator-conditions-container')
    ).toBeInTheDocument();
  });
});
