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

import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import BotsListPage from './BotsListpage.component';

jest.mock('../../components/BotsList/BotsList', () => {
  return jest.fn().mockReturnValue(<div data-testid="bots-list">BotsList</div>);
});
jest.mock('../../axiosAPIs/userAPI', () => ({
  getUsers: jest.fn().mockImplementation(() => Promise.resolve()),
}));

describe('Test BotsList Page Component', () => {
  it('Should render all child elements', async () => {
    const { findByTestId } = render(<BotsListPage />, {
      wrapper: MemoryRouter,
    });

    const botsListComponent = await findByTestId('bots-list');

    expect(botsListComponent).toBeInTheDocument();
  });
});
