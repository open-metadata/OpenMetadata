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

import { render, screen } from '@testing-library/react';
import React from 'react';
import { DiffView } from './DiffView';

const mockDiff = [
  {
    count: 10,
    value: 'This is a raw product ',
  },
  {
    count: 1,
    removed: true,
    value: 'catalog',
  },
  {
    count: 1,
    added: true,
    value: 'catalogue',
  },
  {
    count: 3,
    value: ' table ',
  },
  {
    count: 1,
    removed: true,
    value: 'contains',
  },
  {
    count: 1,
    added: true,
    value: 'containing',
  },
  {
    count: 26,
    value:
      ' the product listing, price, seller etc.. represented in our online DB.',
  },
];

describe('Test DiffView Component', () => {
  it('Should render the component', async () => {
    render(<DiffView diffArr={mockDiff} />);

    const container = await screen.findByTestId('diff-container');

    expect(container).toBeInTheDocument();
  });

  it('Should render the no diff placeholder component if diff list is empty', async () => {
    render(<DiffView diffArr={[]} />);

    const noDiffPlaceholder = await screen.findByTestId('noDiff-placeholder');

    expect(noDiffPlaceholder).toBeInTheDocument();
  });

  it('Should render expected diff values', async () => {
    const newContentList = mockDiff.filter((diff) => diff.added);
    const removedontentList = mockDiff.filter((diff) => diff.removed);

    render(<DiffView diffArr={mockDiff} />);

    const diffAdded = await screen.findAllByTestId('diff-added');
    const diffRemoved = await screen.findAllByTestId('diff-removed');

    expect(diffAdded).toHaveLength(newContentList.length);
    expect(diffRemoved).toHaveLength(removedontentList.length);
  });
});
