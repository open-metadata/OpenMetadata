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

import { findByTestId, queryByTestId, render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { KeyHelp } from './KeyHelp';

describe('Test KeyHelp Component', () => {
  it('Should Render KeyHelp Component if editor value length is greater than 2', async () => {
    const { container } = render(<KeyHelp editorValue="xyz" />, {
      wrapper: MemoryRouter,
    });

    expect(await findByTestId(container, 'key-help')).toBeInTheDocument();
  });

  it('Should Not Render KeyHelp Component if editor value length is less than or equal to 2', async () => {
    const { container } = render(<KeyHelp editorValue="xy" />, {
      wrapper: MemoryRouter,
    });

    expect(queryByTestId(container, 'key-help')).not.toBeInTheDocument();
  });
});
