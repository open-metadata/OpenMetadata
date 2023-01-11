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
import React from 'react';
import SchemaEditor from './SchemaEditor';

describe('SchemaEditor component test', () => {
  it('Component should render properly', async () => {
    render(<SchemaEditor value="" />);

    expect(
      await screen.findByTestId('code-mirror-container')
    ).toBeInTheDocument();
  });

  it('Value provided via props should be visible', async () => {
    render(<SchemaEditor value="test SQL query" />);

    expect(
      (await screen.findByTestId('code-mirror-container')).textContent
    ).toBe('test SQL query');
  });
});
