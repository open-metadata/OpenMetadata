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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { getSuggestions, searchData } from 'rest/miscAPI';
import { SearchIndex } from '../../enums/search.enum';
import NodeSuggestions from './NodeSuggestions.component';

const mockProps = {
  onSelectHandler: jest.fn(),
  entityType: 'TABLE',
};

const entityType = ['TABLE', 'TOPIC', 'DASHBOARD', 'MLMODEL'];

jest.mock('rest/miscAPI', () => ({
  getSuggestions: jest.fn().mockImplementation(() => Promise.resolve()),
  searchData: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test NodeSuggestions Component', () => {
  it('component should render properly', async () => {
    await act(async () => {
      render(<NodeSuggestions {...mockProps} />);
    });

    const suggestionNode = await screen.findByTestId('suggestion-node');

    expect(suggestionNode).toBeInTheDocument();
  });

  entityType.forEach((value) => {
    it(`Suggest & Suggest API for ${value} should work properly`, async () => {
      jest.useFakeTimers('modern');
      const mockSearchData = searchData as jest.Mock;
      const mockSuggestions = getSuggestions as jest.Mock;
      const searchValue = 'sale';
      await act(async () => {
        render(<NodeSuggestions {...mockProps} entityType={value} />);
      });

      // 1st call on page load with empty search string and respective searchIndex
      expect(mockSearchData.mock.calls[0][0]).toBe('');
      expect(mockSearchData.mock.calls[0][6]).toEqual(
        SearchIndex[value as keyof typeof SearchIndex]
      );

      const suggestionNode = await screen.findByTestId('suggestion-node');
      const searchBox = await screen.findByTestId('node-search-box');

      await act(async () => {
        fireEvent.change(searchBox, { target: { value: searchValue } });
      });

      expect(suggestionNode).toBeInTheDocument();
      expect(searchBox).toBeInTheDocument();
      expect(searchBox).toHaveValue(searchValue);

      act(() => {
        jest.runAllTimers();
      });

      expect(mockSearchData.mock.instances).toHaveLength(1);
      expect(mockSuggestions.mock.instances).toHaveLength(1);

      expect(mockSuggestions.mock.calls[0][1]).toEqual(
        SearchIndex[value as keyof typeof SearchIndex]
      );
      expect(mockSuggestions.mock.calls[0][0]).toEqual(searchValue);
    });
  });
});
