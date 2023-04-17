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

import { act, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import SampleDataTopic from './SampleDataTopic';

const mockSampleData = {
  messages: ['{"email":"data","name":"job"}'],
};

jest.mock('react-router-dom', () => ({
  Link: jest.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));
jest.mock('rest/topicsAPI', () => ({
  getTopicByFqn: jest
    .fn()
    .mockImplementation(() => ({ sampleData: mockSampleData })),
}));

describe('Test SampleData Component', () => {
  it('Should render message cards', async () => {
    const { findAllByTestId } = render(<SampleDataTopic topicFQN="" />, {
      wrapper: MemoryRouter,
    });

    expect(await findAllByTestId('message-card')).toHaveLength(
      mockSampleData.messages.length
    );
  });

  it('Should render no data placeholder if no data available', () => {
    act(() => {
      const { getByTestId } = render(<SampleDataTopic topicFQN="" />, {
        wrapper: MemoryRouter,
      });

      const noDataPlaceHolder = getByTestId('no-data');

      expect(noDataPlaceHolder).toBeInTheDocument();
    });
  });
});
