/*
 *  Copyright 2023 Collate.
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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockTagsApiResponse } from 'mocks/Tags.mock';
import React from 'react';
import { getAllTagsForOptions } from 'utils/TagsUtils';
import { AddTags } from './add-tags.component';

const mockSetTags = jest.fn();

jest.mock('../../utils/TagsUtils', () => ({
  ...jest.requireActual('../../utils/TagsUtils'),
  getAllTagsForOptions: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockTagsApiResponse.data)),
}));

describe('AddTags Component', () => {
  it('component should render', async () => {
    const mockGetAllTagsForOptions = getAllTagsForOptions as jest.Mock;
    await act(async () => {
      render(<AddTags setTags={mockSetTags} />);
    });

    expect(await screen.findByRole('combobox')).toBeInTheDocument();
    expect(mockGetAllTagsForOptions).not.toHaveBeenCalled();
  });

  it('Tags api should call once', async () => {
    const mockGetAllTagsForOptions = getAllTagsForOptions as jest.Mock;
    const flushPromises = () => new Promise(setImmediate);
    await act(async () => {
      render(<AddTags setTags={mockSetTags} />);
    });
    const selectBox = await screen.findByRole('combobox');

    // There should not be any call at 1st render
    expect(mockGetAllTagsForOptions.mock.calls).toHaveLength(0);
    expect(selectBox).toBeInTheDocument();

    await act(async () => {
      // Click on select element
      userEvent.click(selectBox);
      await flushPromises();

      expect(
        await mockGetAllTagsForOptions.mock.results[0].value
      ).toStrictEqual(mockTagsApiResponse.data);
    });

    const options = await screen.findAllByRole('option');

    expect(options).toHaveLength(2);

    await act(async () => {
      userEvent.click(options[0]);
    });

    expect(mockGetAllTagsForOptions.mock.calls).toHaveLength(1);
  });
});
