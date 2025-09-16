/*
 *  Copyright 2023 Collate.
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
import { BrowserRouter } from 'react-router-dom';
import LeftSidebar from './LeftSidebar.component';

jest.mock(
  '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider',
  () => ({
    useApplicationsProvider: () => ({ applications: [], plugins: [] }),
  })
);

describe('LeftSidebar', () => {
  it('renders sidebar links correctly', () => {
    render(
      <BrowserRouter>
        <LeftSidebar />
      </BrowserRouter>
    );

    expect(screen.getByTestId('image')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-explore')).toBeInTheDocument();
    expect(screen.getByTestId('observability')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-domain')).toBeInTheDocument();
    expect(screen.getByTestId('governance')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-settings')).toBeInTheDocument();
    expect(screen.getByTestId('app-bar-item-logout')).toBeInTheDocument();
  });
});
