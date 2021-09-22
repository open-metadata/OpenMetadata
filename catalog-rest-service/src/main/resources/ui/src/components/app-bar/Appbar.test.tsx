/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Appbar from './Appbar';

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => {
    return {
      isSignedIn: true,
      isSignedOut: false,
      isAuthenticatedRoute: true,
    };
  },
}));

describe('Test Appbar Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    // Check for statis user for now
    // TODO: Fix the tests when we have actual data
    const dropdown = getByTestId('dropdown-profile');

    expect(dropdown).toBeInTheDocument();
  });

  it('Check for render Items by default', () => {
    const { getAllByTestId } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    const items = getAllByTestId('appbar-item');

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.textContent)).toEqual(['', 'Explore']);
  });

  it('Check for render dropdown item', () => {
    const { getAllByTestId } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    const items = getAllByTestId('dropdown-item');

    expect(items).toHaveLength(2);
  });
});
