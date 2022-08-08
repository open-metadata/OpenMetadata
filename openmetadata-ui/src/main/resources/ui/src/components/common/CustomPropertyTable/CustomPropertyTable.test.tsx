/*
 *  Copyright 2021 Collate
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

import { render } from '@testing-library/react';
import React from 'react';
import { getTypeByFQN } from '../../../axiosAPIs/metadataTypeAPI';
import { EntityType } from '../../../enums/entity.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { CustomPropertyTable } from './CustomPropertyTable';

const mockCustomProperties = [
  {
    name: 'xName',
    description: '',
    propertyType: {
      id: '490724b7-2a7d-42ba-b61e-27128e8b0f32',
      type: 'type',
      name: 'string',
      fullyQualifiedName: 'string',
      description: '"A String type."',
      displayName: 'string',
      href: 'http://localhost:8585/api/v1/metadata/types/490724b7-2a7d-42ba-b61e-27128e8b0f32',
    },
  },
];

jest.mock('../../../utils/CommonUtils', () => ({
  isEven: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('./PropertyValue', () => ({
  PropertyValue: jest.fn().mockReturnValue(<div>PropertyValue</div>),
}));

jest.mock('../../../axiosAPIs/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: { customProperties: mockCustomProperties },
    })
  ),
}));

const mockTableDetails = {} as Table & Topic & Dashboard & Pipeline & Mlmodel;
const handleExtentionUpdate = jest.fn();

const mockProp = {
  entityDetails: mockTableDetails,
  handleExtentionUpdate,
  entityType: EntityType.TABLE,
};

describe('Test CustomProperty Table Component', () => {
  it('Should render table component', async () => {
    const { findByTestId, findAllByTestId } = render(
      <CustomPropertyTable {...mockProp} />
    );
    const table = await findByTestId('custom-properties-table');

    expect(table).toBeInTheDocument();

    const propertyName = await findByTestId('property-name');
    const propertyValue = await findByTestId('property-value');

    expect(propertyName).toBeInTheDocument();
    expect(propertyValue).toBeInTheDocument();

    const dataRows = await findAllByTestId('data-row');

    expect(dataRows).toHaveLength(mockCustomProperties.length);
  });

  it('Should render no data placeholder if custom properties list is empty', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ data: { customProperties: [] } })
    );
    const { findByTestId } = render(<CustomPropertyTable {...mockProp} />);
    const table = await findByTestId('custom-properties-table');

    expect(table).toBeInTheDocument();

    const propertyName = await findByTestId('property-name');
    const propertyValue = await findByTestId('property-value');

    expect(propertyName).toBeInTheDocument();
    expect(propertyValue).toBeInTheDocument();

    const noDataRow = await findByTestId('no-data-row');

    expect(noDataRow).toBeInTheDocument();
  });
});
