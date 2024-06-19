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
import React from 'react';
import { DatabaseServiceType } from '../../../../generated/entity/data/database';
import { DatabaseServiceSearchSource } from '../../../../interface/search.interface';
import DataAssetCard from './DataAssetCard.component';

jest.mock('../../../../constants/constants', () => ({
  getServiceDetailsPath: jest.fn(),
}));

jest.mock('../../../../utils/CommonUtils', () => ({
  getServiceLogo: jest.fn().mockReturnValue('getServiceLogo'),
}));

jest.mock('../../../../utils/EntityUtils', () => ({
  getEntityName: jest.fn().mockReturnValue('getEntityName'),
}));

jest.mock('../../../common/RichTextEditor/RichTextEditorPreviewer', () =>
  jest.fn().mockReturnValue(<p>RichTextEditorPreviewer</p>)
);

const mockLinkButton = jest.fn();

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children, ...rest }) => (
    <a {...rest} onClick={mockLinkButton}>
      {children}
    </a>
  )),
}));

const mockServiceData: DatabaseServiceSearchSource = {
  id: 'af99b03d-a42c-46de-a5fc-90b1fff2702e',
  name: 'sample_data',
  fullyQualifiedName: 'sample_data',
  serviceType: DatabaseServiceType.BigQuery,
  tags: [],
  version: 0.1,
  updatedAt: 1718778169562,
  updatedBy: 'admin',
  deleted: false,
  dataProducts: [],
  entityType: 'databaseService',
  type: 'test',
};

describe('DataAssetCard', () => {
  it('should render DataAssetCard', () => {
    render(<DataAssetCard service={mockServiceData} />);

    expect(screen.getByText('getServiceLogo')).toBeInTheDocument();
    expect(screen.getByText('getEntityName')).toBeInTheDocument();
    expect(screen.getByText('label.no-description')).toBeInTheDocument();
    expect(screen.getByText('getEntityName')).toBeInTheDocument();
    expect(screen.getByText('label.type:')).toBeInTheDocument();
    expect(screen.getByText(DatabaseServiceType.BigQuery)).toBeInTheDocument();

    expect(
      screen.queryByText('RichTextEditorPreviewer')
    ).not.toBeInTheDocument();
  });

  it('should render description', () => {
    render(
      <DataAssetCard
        service={{ ...mockServiceData, description: 'this is description' }}
      />
    );

    expect(screen.getByText('RichTextEditorPreviewer')).toBeInTheDocument();
  });

  it('should trigger route change on card click', () => {
    render(<DataAssetCard service={mockServiceData} />);

    fireEvent.click(
      screen.getByTestId(`data-asset-service-${mockServiceData.name}`)
    );

    expect(mockLinkButton).toHaveBeenCalled();
  });
});
