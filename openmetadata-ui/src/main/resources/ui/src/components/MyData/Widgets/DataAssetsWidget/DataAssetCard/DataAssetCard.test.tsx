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
import { fireEvent, render, screen } from '@testing-library/react';
import { Bucket } from 'Models';
import React from 'react';
import { getExplorePath } from '../../../../../constants/constants';
import DataAssetCard from './DataAssetCard.component';

const mockLinkButton = jest.fn();

jest.mock('../../../../../constants/constants', () => ({
  getExplorePath: jest.fn(),
}));

jest.mock('../../../../../utils/CommonUtils', () => ({
  getServiceLogo: jest.fn().mockReturnValue('getServiceLogo'),
}));

jest.mock('../../../../../utils/ServiceUtilClassBase', () => ({
  getDataAssetsService: jest.fn().mockReturnValue('tables'),
}));

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, ...rest }) => (
    <a {...rest} onClick={mockLinkButton}>
      {children}
    </a>
  )),
}));

const mockServiceData: Bucket = {
  doc_count: 161,
  key: 'mysql',
};

describe('DataAssetCard', () => {
  it('should render DataAssetCard', () => {
    render(<DataAssetCard service={mockServiceData} />);

    expect(screen.getByText('getServiceLogo')).toBeInTheDocument();
    expect(screen.getByText('Mysql')).toBeInTheDocument();
    expect(screen.getByText('161')).toBeInTheDocument();

    expect(getExplorePath).toHaveBeenCalledWith({
      extraParameters: {
        page: '1',
        quickFilter:
          '{"query":{"bool":{"must":[{"bool":{"should":[{"term":{"serviceType":"mysql"}}]}}]}}}',
      },
      tab: 'tables',
    });
  });

  it('should trigger route change on card click', () => {
    render(<DataAssetCard service={mockServiceData} />);

    fireEvent.click(
      screen.getByTestId(`data-asset-service-${mockServiceData.key}`)
    );

    expect(mockLinkButton).toHaveBeenCalled();
  });
});
