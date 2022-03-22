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

import {
  findByTestId,
  findByText,
  queryByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import FeedListSeparator from './FeedListSeparator';

const mockFeedListSeparatorProp = {
  relativeDay: 'today',
};

describe('Test FeedListSeperator component', () => {
  it('Check if FeedListSeperator has all child elements', async () => {
    const { container } = render(
      <FeedListSeparator {...mockFeedListSeparatorProp} />,
      { wrapper: MemoryRouter }
    );
    const relativeDayText = await findByText(container, /today/i);
    const separator = await findByTestId(container, 'separator');
    const relativeDay = await findByTestId(container, 'relativeday');

    expect(relativeDayText).toBeInTheDocument();
    expect(separator).toBeInTheDocument();
    expect(relativeDay).toBeInTheDocument();
  });

  it('Check if FeedListSeperator has relativeday as empty string', async () => {
    const { container } = render(
      <FeedListSeparator {...mockFeedListSeparatorProp} relativeDay="" />,
      { wrapper: MemoryRouter }
    );

    const separator = await findByTestId(container, 'separator');
    const relativeDay = queryByTestId(container, 'relativeday');

    expect(separator).toBeInTheDocument();
    expect(relativeDay).not.toBeInTheDocument();
  });
});
