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

import { getByTestId, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PageNotFound from './PageNotFound';

jest.mock('../../constants/constants', () => ({
  ROUTES: {},
}));

describe('Test PageNotFound Component', () => {
  it('Component should render', () => {
    const { container } = render(<PageNotFound />, {
      wrapper: MemoryRouter,
    });
    const noPage = getByTestId(container, 'no-page-found');

    expect(noPage).toBeInTheDocument();
  });

  it('There should be 2 buttons on the component', () => {
    const { container } = render(<PageNotFound />, {
      wrapper: MemoryRouter,
    });
    const buttons = getByTestId(container, 'route-links');

    expect(buttons.childElementCount).toBe(2);
  });
});
