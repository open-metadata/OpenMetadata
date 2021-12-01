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
import FilterContainer from './FilterContainer';

const mockSelect = jest.fn();

describe('Test FilterContainer Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <FilterContainer
        count={5}
        isDisabled={false}
        isSelected={false}
        name="test"
        type="service type"
        onSelect={mockSelect}
      />
    );

    expect(getByTestId(container, 'filter-container')).toBeInTheDocument();
  });

  it('onClick of checkbox callback function should call', () => {
    const { container } = render(
      <FilterContainer
        count={5}
        isDisabled={false}
        isSelected={false}
        name="test"
        type="service type"
        onSelect={mockSelect}
      />
    );

    const checkbox = getByTestId(container, 'checkbox');
    fireEvent.click(
      checkbox,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockSelect).toBeCalledTimes(1);
  });

  it('if disable onClick of checkbox callback function should not call', () => {
    const { container } = render(
      <FilterContainer
        isDisabled
        count={5}
        isSelected={false}
        name="test"
        type="service type"
        onSelect={mockSelect}
      />
    );

    const checkbox = getByTestId(container, 'checkbox');

    expect(checkbox).toBeDisabled();
  });
});
