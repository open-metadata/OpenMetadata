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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { Thread } from '../../../generated/entity/feed/thread';
import ClosedTask from './ClosedTask';

const mockTask = {
  id: 19,
  type: 'RequestDescription',
  assignees: [
    {
      id: '5a5b7951-60ca-4063-afb5-a0e51538ab71',
      type: 'user',
      name: 'marisa',
      fullyQualifiedName: 'marisa',
      displayName: 'Marisa Smith',
      deleted: false,
    },
    {
      id: '82b61b9a-1485-4069-a850-3c862139307e',
      type: 'user',
      name: 'sachin.c',
      fullyQualifiedName: 'sachin.c',
      displayName: 'Sachin Chaurasiya',
      deleted: false,
    },
  ],
  status: 'Closed',
  closedBy: 'sachin.c',
  closedAt: 1657351363635,
  oldValue: '',
  suggestion: 'Can you suggest a description?',
  newValue: '**Column for storing product data.**',
} as Thread['task'];

jest.mock('../../../components/common/PopOverCard/UserPopOverCard', () =>
  jest.fn().mockImplementation(({ children }) => {
    return <div data-testid="userPopOverCard">{children}</div>;
  })
);

jest.mock('../../../utils/TimeUtils', () => ({
  getDayTimeByTimeStamp: jest.fn().mockReturnValue('07 / 09 / 2022'),
}));

describe('Test ClosedTask Component', () => {
  it('Should render component', async () => {
    render(<ClosedTask task={mockTask} />);

    const container = await screen.findByTestId('task-closed');

    const userCardPopover = await screen.findByTestId('userPopOverCard');

    const closedBy = await screen.findByTestId('task-closedby');

    const closedAt = await screen.findByTestId('task-closedAt');

    expect(container).toBeInTheDocument();
    expect(userCardPopover).toBeInTheDocument();
    expect(closedBy).toBeInTheDocument();
    expect(closedAt).toBeInTheDocument();

    expect(closedBy).toHaveTextContent(mockTask?.closedBy || '');
    expect(closedAt).toHaveTextContent('07 / 09 / 2022');
  });
});
