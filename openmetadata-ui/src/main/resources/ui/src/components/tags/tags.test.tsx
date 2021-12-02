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

import { fireEvent, getByTestId, render } from '@testing-library/react';
import React from 'react';
import Tags from './tags';

const mockCallback = jest.fn();

describe('Test tags Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <Tags editable removeTag={mockCallback} startWith="#" tag="test" />
    );
    const tags = getByTestId(container, 'tags');
    const remove = getByTestId(container, 'remove');

    expect(tags).toBeInTheDocument();
    expect(remove).toBeInTheDocument();
  });

  it('onClick of X callback function should call', () => {
    const { container } = render(
      <Tags editable removeTag={mockCallback} startWith="#" tag="test" />
    );
    const remove = getByTestId(container, 'remove');
    fireEvent.click(
      remove,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockCallback).toBeCalledTimes(1);
  });
});
