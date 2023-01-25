/*
 *  Copyright 2022 Collate.
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

import {
  act,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import React from 'react';
import { getTypeByFQN } from 'rest/metadataTypeAPI';
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

jest.mock('../error-with-placeholder/ErrorPlaceHolder', () => {
  return jest.fn().mockReturnValue(<div>ErrorPlaceHolder.component</div>);
});

jest.mock('components/Loader/Loader', () => {
  return jest.fn().mockReturnValue(<div data-testid="loader">Loader</div>);
});

jest.mock('rest/metadataTypeAPI', () => ({
  getTypeByFQN: jest.fn().mockImplementation(() =>
    Promise.resolve({
      customProperties: mockCustomProperties,
    })
  ),
}));

const mockTableDetails = {} as Table & Topic & Dashboard & Pipeline & Mlmodel;
const handleExtensionUpdate = jest.fn();

const mockProp = {
  entityDetails: mockTableDetails,
  handleExtensionUpdate,
  entityType: EntityType.TABLE,
  hasEditAccess: true,
};

describe('Test CustomProperty Table Component', () => {
  it('Should render table component', async () => {
    await act(async () => {
      render(<CustomPropertyTable {...mockProp} />);
    });
    const table = await screen.findByTestId('custom-properties-table');

    expect(table).toBeInTheDocument();

    const propertyName = await screen.findByText('Name');
    const propertyValue = await screen.findByText('Value');
    const rows = await screen.findAllByRole('row');

    expect(propertyName).toBeInTheDocument();
    expect(propertyValue).toBeInTheDocument();
    expect(rows).toHaveLength(mockCustomProperties.length + 1);
  });

  it('Should render no data placeholder if custom properties list is empty', async () => {
    (getTypeByFQN as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ customProperties: [] })
    );
    await act(async () => {
      render(<CustomPropertyTable {...mockProp} />);
    });
    const noDataPlaceHolder = await screen.findByText(
      'ErrorPlaceHolder.component'
    );

    expect(noDataPlaceHolder).toBeInTheDocument();
  });

  it('Loader should be shown while loading the custom properties', async () => {
    (getTypeByFQN as jest.Mock).mockResolvedValueOnce(Promise.resolve({}));
    render(<CustomPropertyTable {...mockProp} />);

    // To check if loader was rendered when the loading state was true and then removed after loading is false
    await waitForElementToBeRemoved(() => screen.getByTestId('loader'));
  });
});
