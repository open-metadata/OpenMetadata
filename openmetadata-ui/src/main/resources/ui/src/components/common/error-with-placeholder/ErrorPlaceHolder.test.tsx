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

import { getByTestId, getByText, render } from '@testing-library/react';
import React from 'react';
import ErrorPlaceHolder from './ErrorPlaceHolder';

describe('Test Error place holder Component', () => {
  it('Component should render', () => {
    const { container } = render(
      <ErrorPlaceHolder>
        <p>Children1</p>
      </ErrorPlaceHolder>
    );

    expect(getByTestId(container, 'error')).toBeInTheDocument();
    expect(getByTestId(container, 'no-data-image')).toBeInTheDocument();
    expect(getByText(container, 'Children1')).toBeInTheDocument();
  });
});
