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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { Type } from '../../generated/entity/type';
import { LeftPanel } from './LeftPanel';

const typeList = [
  {
    id: '311ff2b1-472d-4307-878a-6e41b36a852d',
    name: 'table',
    fullyQualifiedName: 'table',
    displayName: 'table',
    description: '""',
    category: 'entity',
    nameSpace: 'data',
    schema: '',
    version: 0.2,
    updatedAt: 1653903654718,
    updatedBy: 'anonymous',
    href: 'http://localhost:8585/api/v1/metadata/types/311ff2b1-472d-4307-878a-6e41b36a852d',
  },
] as Array<Type>;

const selectedType = typeList[0];

const mockPush = jest.fn();

const MOCK_HISTORY = {
  push: mockPush,
};

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => MOCK_HISTORY),
}));

jest.mock('../../constants/constants', () => {
  return {
    getCustomEntityPath: jest.fn().mockReturnValue('entityPath'),
  };
});

const mockProp = {
  selectedType,
  typeList,
};

describe('Test CustomEntity Detail Left Panel Component', () => {
  it('Should render Left Panel Component', async () => {
    const { findByTestId } = render(<LeftPanel {...mockProp} />);

    const panelHeading = await findByTestId('panel-heading');

    expect(panelHeading).toBeInTheDocument();

    typeList.forEach(async (type) => {
      expect(
        await findByTestId(`entity-${type.displayName}`)
      ).toBeInTheDocument();
    });
  });

  it('Should call history.push on click of entity name', async () => {
    const { findByTestId } = render(<LeftPanel {...mockProp} />);

    const entity = await findByTestId(`entity-${typeList[0].displayName}`);

    expect(entity).toBeInTheDocument();

    fireEvent.click(entity);

    expect(mockPush).toHaveBeenCalled();
  });
});
