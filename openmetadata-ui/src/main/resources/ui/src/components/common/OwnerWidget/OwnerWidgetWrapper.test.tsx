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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import OwnerWidgetWrapper from './OwnerWidgetWrapper.component';

const mockSearchAPI = jest.fn();
const mockHideWidget = jest.fn();

jest.mock('utils/UserDataUtils', () => ({
  searchFormattedUsersAndTeams: mockSearchAPI,
}));

const mockProps = {
  visible: true,
  currentUser: { id: '1', type: 'User' },
  hideWidget: mockHideWidget,
};

describe('OwnerWidgetWrapper', () => {
  it('Should renders the component when visible is true', () => {
    render(<OwnerWidgetWrapper {...mockProps} />);
    const dropDownList = screen.getByTestId('dropdown-list');
    const searchBox = screen.getByTestId('searchInputText');

    expect(dropDownList).toBeInTheDocument();
    expect(searchBox).toBeInTheDocument();
  });

  it('Should not render the component when visible is false', () => {
    render(<OwnerWidgetWrapper {...mockProps} visible={false} />);

    const component = screen.queryByTestId('dropdown-list');

    expect(component).toBeNull();
  });

  it('Search Should work', async () => {
    render(<OwnerWidgetWrapper {...mockProps} />);

    const searchInput = screen.getByTestId('searchInputText');

    await act(async () => {
      fireEvent.change(searchInput, {
        target: {
          value: 'user1',
        },
      });
    });

    expect(searchInput).toHaveValue('user1');
  });

  it('Hide Widget should work', async () => {
    render(<OwnerWidgetWrapper {...mockProps} />);

    const backdropButton = screen.getByTestId('backdrop-button');

    await act(async () => {
      userEvent.click(backdropButton);
    });

    expect(mockHideWidget).toHaveBeenCalled();
  });
});
