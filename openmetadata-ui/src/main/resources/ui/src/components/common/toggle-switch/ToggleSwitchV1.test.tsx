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

import { findByTestId, fireEvent, render } from '@testing-library/react';
import React from 'react';
import ToggleSwitchV1 from './ToggleSwitchV1';

const mockFn = jest.fn();

describe('Test SuccessScreen component', () => {
  it('SuccessScreen component should render', async () => {
    const { container } = render(
      <ToggleSwitchV1 checked={false} handleCheck={mockFn} />
    );

    const toggleButton = await findByTestId(container, 'toggle-button');
    fireEvent.click(toggleButton);

    expect(toggleButton).toBeInTheDocument();
    expect(mockFn).toBeCalled();
  });
});
