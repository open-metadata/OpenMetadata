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
import { TagsTabs } from './TagsTabs';

jest.mock('./TagSuggestion', () =>
  jest
    .fn()
    .mockReturnValue(<div data-testid="tagSuggestion">TagSuggestion</div>)
);

jest.mock('./TagsDiffView', () => ({
  TagsDiffView: jest
    .fn()
    .mockReturnValue(<div data-testid="DiffView">DiffView</div>),
}));

const mockProps = {
  tags: [],
  value: [],
  onChange: jest.fn(),
};

const tabList = ['Current', 'Diff', 'New'];

describe('Test Description Tabs Component', () => {
  it('Should render the component', async () => {
    render(<TagsTabs {...mockProps} />);

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(tabList.length);

    expect(await screen.findByText('Current')).toBeInTheDocument();
    expect(await screen.findByText('Diff')).toBeInTheDocument();
    expect(await screen.findByText('New')).toBeInTheDocument();
  });

  it('Should render the component relevant tab component', async () => {
    render(<TagsTabs {...mockProps} />);

    const tabs = await screen.findAllByRole('tab');

    expect(tabs).toHaveLength(tabList.length);

    expect(await screen.findByText('Current')).toBeInTheDocument();

    expect(await screen.findByText('Diff')).toBeInTheDocument();

    expect(await screen.findByText('New')).toBeInTheDocument();
  });
});
