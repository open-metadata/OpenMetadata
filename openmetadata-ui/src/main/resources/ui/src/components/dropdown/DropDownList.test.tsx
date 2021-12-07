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
  fireEvent,
  getAllByTestId,
  getByTestId,
  render,
} from '@testing-library/react';
import React from 'react';
import DropDownList from './DropDownList';

const dropDownList = [
  {
    name: 'test 1',
    value: 'd155f04f-ce16-4d4e-8698-23c88d293312',
  },
  {
    name: 'test 2',
    value: 'd155f04f-ce16-4d4e-8698-23c88d293312',
  },
];
const listGroups = ['Teams'];

const MockOnSelect = jest.fn();

describe('Test DropDownList Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <DropDownList
        dropDownList={dropDownList}
        listGroups={listGroups}
        value=""
        onSelect={MockOnSelect}
      />
    );

    expect(getByTestId(container, 'dropdown-list')).toBeInTheDocument();
  });

  it('Number of options should be same as provided', () => {
    const { container } = render(
      <DropDownList
        dropDownList={dropDownList}
        listGroups={listGroups}
        value=""
        onSelect={MockOnSelect}
      />
    );

    expect(getAllByTestId(container, 'list-item').length).toBe(2);
  });

  it('OnSelect of List item, callback should be called', () => {
    const { container } = render(
      <DropDownList
        dropDownList={dropDownList}
        listGroups={listGroups}
        value=""
        onSelect={MockOnSelect}
      />
    );

    const listItem = getAllByTestId(container, 'list-item');
    fireEvent.click(
      listItem[0],
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(MockOnSelect).toBeCalledTimes(1);
  });
});
