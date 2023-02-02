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

import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { Button } from './Button';

const mockFunction = jest.fn();

describe('Test Button Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <Button
        data-testid="button"
        size="regular"
        theme="primary"
        variant="outlined"
        onClick={mockFunction}>
        test button
      </Button>
    );

    const button = getByTestId('button');

    expect(button).toBeInTheDocument();
  });

  it('OnClick callback function should call', () => {
    const { getByTestId } = render(
      <Button
        data-testid="button"
        size="regular"
        theme="primary"
        variant="outlined"
        onClick={mockFunction}>
        test button
      </Button>
    );

    const button = getByTestId('button');
    fireEvent(
      button,
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })
    );

    expect(mockFunction).toHaveBeenCalledTimes(1);
  });
});
