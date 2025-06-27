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
import { Form } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SelectAssetTypeField } from './SelectAssetTypeField.component';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock(
  '../../../../Explore/AdvanceSearchProvider/AdvanceSearchProvider.component',
  () => ({
    useAdvanceSearch: jest.fn().mockReturnValue({
      config: {},
      onChangeSearchIndex: jest.fn(),
    }),
  })
);

jest.mock('../../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getEntityTypeSearchIndexMapping: jest.fn().mockReturnValue({
      table: 'table_search_index',
      dashboard: 'dashboard_search_index',
    }),
  },
}));

jest.mock('../../../../../utils/Alerts/AlertsUtil', () => ({
  getSourceOptionsFromResourceList: jest.fn().mockReturnValue([
    { label: 'Table', value: 'table' },
    { label: 'Dashboard', value: 'dashboard' },
  ]),
}));

jest.mock('../../../../../utils/CuratedAssetsUtils', () => ({
  AlertMessage: jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="alert-message">Alert Message</div>
    )),
  APP_CONFIG_PATH: ['sourceConfig', 'config', 'appConfig'],
  getExploreURLWithFilters: jest.fn().mockReturnValue('test-url'),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
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

describe('SelectAssetTypeField', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string) => key,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders component with correct label and placeholder', () => {
    render(
      <TestWrapper>
        <SelectAssetTypeField {...defaultProps} />
      </TestWrapper>
    );

    expect(
      screen.getByLabelText('label.select-asset-type')
    ).toBeInTheDocument();
  });

  it('handles asset type selection', async () => {
    render(
      <TestWrapper>
        <SelectAssetTypeField {...defaultProps} />
      </TestWrapper>
    );

    const select = screen.getByTestId('asset-type-select');

    await act(async () => {
      fireEvent.click(select);
    });

    const tableOption = screen.getByText('Table');

    await act(async () => {
      fireEvent.click(tableOption);
    });

    expect(tableOption).toBeInTheDocument();
  });

  it('displays loading skeleton when count is loading', () => {
    const propsWithLoading = {
      ...defaultProps,
      selectedAssetsInfo: {
        ...mockSelectedAssetsInfo,
        isCountLoading: true,
      },
    };

    render(
      <TestWrapper>
        <SelectAssetTypeField {...propsWithLoading} />
      </TestWrapper>
    );

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('displays alert message when resource count is available', async () => {
    const propsWithCount = {
      ...defaultProps,
      selectedAssetsInfo: {
        ...mockSelectedAssetsInfo,
        resourceCount: 5,
      },
    };

    await act(async () => {
      render(
        <TestWrapper>
          <SelectAssetTypeField {...propsWithCount} />
        </TestWrapper>
      );
    });

    expect(screen.getByTestId('alert-message')).toBeInTheDocument();
  });
});
