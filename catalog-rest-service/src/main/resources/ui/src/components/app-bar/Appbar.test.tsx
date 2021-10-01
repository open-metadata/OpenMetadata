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

import {
  findAllByTestId,
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import Appbar from './Appbar';

jest.mock('../../hooks/authHooks', () => ({
  useAuth: () => {
    return {
      isSignedIn: true,
      isSignedOut: false,
      isAuthenticatedRoute: true,
      isAuthDisabled: true,
    };
  },
}));

jest.mock('../Modals/WhatsNewModal', () => ({
  WhatsNewModal: jest.fn().mockReturnValue(<p>WhatsNewModal</p>),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  getVersion: jest.fn().mockImplementation(() =>
    Promise.resolve({
      data: {
        version: '0.5.0-SNAPSHOT',
      },
    })
  ),
}));

describe('Test Appbar Component', () => {
  it('Component should render', async () => {
    const { container } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });

    const dropdown = await findByTestId(container, 'dropdown-profile');
    const whatsnewModal = await findByTestId(container, 'whatsnew-modal');
    const greetingText = await findByTestId(container, 'greeting-text');

    expect(dropdown).toBeInTheDocument();
    expect(whatsnewModal).toBeInTheDocument();
    expect(greetingText).toBeInTheDocument();
  });

  it('Check for render Items by default', async () => {
    const { container } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });
    const items = await findAllByTestId(container, 'appbar-item');

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.textContent)).toEqual(['', 'Explore']);
  });

  it('onClick of whatsNewModal, it should open', async () => {
    const { container } = render(<Appbar />, {
      wrapper: MemoryRouter,
    });

    const whatsnewModal = await findByTestId(container, 'whatsnew-modal');
    fireEvent.click(whatsnewModal);

    expect(await findByText(container, /WhatsNewModal/i)).toBeInTheDocument();
  });
});
