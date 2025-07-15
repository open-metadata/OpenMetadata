/*
 *  Copyright 2024 Collate.
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
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchIndex } from '../../../../enums/search.enum';
import { searchData } from '../../../../rest/miscAPI';
import { MOCK_EXPLORE_SEARCH_RESULTS } from '../../../Explore/Explore.mock';
import DataAssetsWidget from './DataAssetsWidget.component';

// Mock useNavigate hook
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./DataAssetCard/DataAssetCard.component', () =>
  jest.fn().mockReturnValue(<p>DataAssetCard</p>)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>)
);

jest.mock('../../../../utils/CommonUtils', () => ({
  Transi18next: jest.fn().mockReturnValue('text'),
}));

const mockHandleRemoveWidget = jest.fn();

const widgetProps = {
  isEditView: true,
  widgetKey: 'testWidgetKey',
  handleRemoveWidget: mockHandleRemoveWidget,
  handleLayoutUpdate: jest.fn(),
  currentLayout: [
    {
      i: 'testWidgetKey',
      x: 0,
      y: 0,
      w: 2,
      h: 4,
      config: {},
    },
  ],
};

describe('DataAssetsWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderDataAssetsWidget = (props = {}) => {
    return render(
      <MemoryRouter>
        <DataAssetsWidget {...widgetProps} {...props} />
      </MemoryRouter>
    );
  };

  it('should fetch dataAssets initially', () => {
    renderDataAssetsWidget();

    expect(searchData).toHaveBeenCalledWith('', 0, 0, '', 'updatedAt', '', [
      SearchIndex.TABLE,
      SearchIndex.TOPIC,
      SearchIndex.DASHBOARD,
      SearchIndex.PIPELINE,
      SearchIndex.MLMODEL,
      SearchIndex.CONTAINER,
      SearchIndex.SEARCH_INDEX,
      SearchIndex.API_ENDPOINT_INDEX,
    ]);
  });

  it('should render DataAssetsWidget with widget wrapper', async () => {
    (searchData as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        data: {
          aggregations: { 'sterms#serviceType': { buckets: [] } },
        },
      })
    );

    renderDataAssetsWidget();

    expect(await screen.findByTestId('widget-wrapper')).toBeInTheDocument();
    expect(await screen.findByTestId('widget-header')).toBeInTheDocument();
    expect(screen.getByText('label.data-asset-plural')).toBeInTheDocument();
  });

  it('should render empty state when no data assets', async () => {
    (searchData as jest.Mock).mockImplementation(() =>
      Promise.resolve({
        data: {
          aggregations: { 'sterms#serviceType': { buckets: [] } },
        },
      })
    );

    renderDataAssetsWidget();

    expect(await screen.findByTestId('widget-empty-state')).toBeInTheDocument();
    expect(screen.queryByText('DataAssetCard')).not.toBeInTheDocument();
  });

  it('should render DataAsset cards when data is present', async () => {
    (searchData as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: MOCK_EXPLORE_SEARCH_RESULTS })
    );

    renderDataAssetsWidget();

    expect(await screen.findByTestId('widget-wrapper')).toBeInTheDocument();
    expect(await screen.findByTestId('widget-header')).toBeInTheDocument();
    expect(
      await screen.findByText('label.data-asset-plural')
    ).toBeInTheDocument();
    expect(await screen.findAllByText('DataAssetCard')).toHaveLength(10);
    expect(await screen.findByTestId('widget-footer')).toBeInTheDocument();
  });

  it('should render footer when data assets are available', async () => {
    (searchData as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: MOCK_EXPLORE_SEARCH_RESULTS })
    );

    renderDataAssetsWidget();

    expect(await screen.findByTestId('widget-footer')).toBeInTheDocument();
    expect(await screen.findByText('label.view-more')).toBeInTheDocument();
  });
});
