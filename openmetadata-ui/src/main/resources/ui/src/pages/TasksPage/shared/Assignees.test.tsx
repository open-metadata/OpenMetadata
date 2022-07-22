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

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import Assignees from './Assignees';

const mockOptions = [
  {
    label: 'adam_matthews2',
    value: 'b76b005d-3540-4f85-86db-197abdcaf351',
    type: 'user',
  },
  {
    label: 'alec_kane4',
    value: 'c1c41191-fee0-4754-b1a4-55079f8ff0df',
    type: 'user',
  },
  {
    label: 'alex_pollard9',
    value: 'ad861728-76d4-4b03-be5e-f0655b71a9ac',
    type: 'user',
  },
  {
    label: 'alexa_jordan3',
    value: '932cf7c1-feee-4760-84c6-3accfa0aed0b',
    type: 'user',
  },
  {
    label: 'alexander_jackson5',
    value: 'e29c826a-41af-41eb-ac5e-595b6967839e',
    type: 'user',
  },
];

const mockProps = {
  options: mockOptions,
  assignees: mockOptions,
  onSearch: jest.fn(),
  onChange: jest.fn(),
};

describe('Test assignees component', () => {
  it('Should render the component', async () => {
    render(<Assignees {...mockProps} />);

    const container = await screen.findByRole('combobox');

    fireEvent.change(container, { target: { value: 'a' } });

    const options = await screen.findAllByTestId('assignee-option');

    expect(container).toBeInTheDocument();

    expect(options).toHaveLength(mockOptions.length);
  });
});
