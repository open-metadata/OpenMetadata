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
import { MemoryRouter } from 'react-router-dom';
import { RowData } from './RowData';

jest.mock('../Modals/SchemaModal/SchemaModal', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="schema-modal">Schema Modal</div>);
});

const mockProp = {
  data: {},
};

describe('Test RowData Component', () => {
  it('Should render json data if data is typeof object', async () => {
    const { findByTestId } = render(<RowData {...mockProp} />, {
      wrapper: MemoryRouter,
    });

    const jsonData = await findByTestId('json-object');

    expect(jsonData).toBeInTheDocument();

    fireEvent.click(jsonData);

    expect(await findByTestId('schema-modal')).toBeInTheDocument();
  });

  it('Should render string data if data is not a tyeopf object', async () => {
    const { findByTestId } = render(<RowData data="data" />, {
      wrapper: MemoryRouter,
    });

    const stringData = await findByTestId('string-data');

    expect(stringData).toBeInTheDocument();
  });

  it('Should render fallback data if no data is there', async () => {
    const { findByTestId } = render(<RowData data={undefined} />, {
      wrapper: MemoryRouter,
    });

    const emptyData = await findByTestId('empty-data');

    expect(emptyData).toBeInTheDocument();
  });
});
