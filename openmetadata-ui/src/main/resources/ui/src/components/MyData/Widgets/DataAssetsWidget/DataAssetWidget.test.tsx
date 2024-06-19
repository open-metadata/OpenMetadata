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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { searchData } from '../../../../rest/miscAPI';
import { MOCK_EXPLORE_SEARCH_RESULTS } from '../../../Explore/Explore.mock';
import DataAssetsWidget from './DataAssetsWidget.component';

jest.mock('../../../../rest/miscAPI', () => ({
  searchData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./DataAssetCard.component', () =>
  jest.fn().mockReturnValue(<p>DataAssetCard</p>)
);

jest.mock('../../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockReturnValue(<p>ErrorPlaceHolder</p>)
);

const mockHandleRemoveWidget = jest.fn();

const widgetProps = {
  selectedGridSize: 10,
  isEditView: true,
  widgetKey: 'testWidgetKey',
  handleRemoveWidget: mockHandleRemoveWidget,
};

describe('DataAssetsWidget', () => {
  it('should fetch dataAssets initially', async () => {
    render(<DataAssetsWidget {...widgetProps} />);

    expect(searchData).toHaveBeenCalledWith('', 1, 50, '', 'updatedAt', '', [
      SearchIndex.DATABASE_SERVICE,
      SearchIndex.MESSAGING_SERVICE,
      SearchIndex.DASHBOARD_SERVICE,
      SearchIndex.PIPELINE_SERVICE,
      SearchIndex.ML_MODEL_SERVICE,
      SearchIndex.STORAGE_SERVICE,
      SearchIndex.SEARCH_SERVICE,
    ]);
  });

  it('should render DataAssetsWidget', async () => {
    await act(async () => {
      render(<DataAssetsWidget {...widgetProps} />);

      expect(screen.getByTestId('data-assets-widget')).toBeInTheDocument();
      expect(screen.getByText('label.service-plural')).toBeInTheDocument();
      expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
      expect(screen.queryByText('DataAssetCard')).not.toBeInTheDocument();
    });
  });

  it('should handle close click when in edit view', async () => {
    await act(async () => {
      render(<DataAssetsWidget {...widgetProps} />);

      fireEvent.click(screen.getByTestId('remove-widget-button'));

      expect(mockHandleRemoveWidget).toHaveBeenCalledWith(
        widgetProps.widgetKey
      );
    });
  });

  it('should render ErrorPlaceholder if API is rejected', async () => {
    (searchData as jest.Mock).mockImplementation(() => Promise.reject());
    await act(async () => {
      render(<DataAssetsWidget {...widgetProps} />);
    });

    expect(screen.getByText('ErrorPlaceHolder')).toBeInTheDocument();
  });

  it('should render DataAsset card if data present', async () => {
    (searchData as jest.Mock).mockImplementation(() =>
      Promise.resolve({ data: MOCK_EXPLORE_SEARCH_RESULTS })
    );
    await act(async () => {
      render(<DataAssetsWidget {...widgetProps} />);
    });

    expect(screen.getByText('DataAssetCard')).toBeInTheDocument();
    expect(screen.queryByText('ErrorPlaceHolder')).not.toBeInTheDocument();
  });
});
