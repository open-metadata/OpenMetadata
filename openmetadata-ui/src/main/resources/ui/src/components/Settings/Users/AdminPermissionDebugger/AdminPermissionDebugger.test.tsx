/*
 *  Copyright 2025 Collate.
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
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import AdminPermissionDebugger from './AdminPermissionDebugger.component';

// The panel's own behaviour is covered by AccessControlDebuggerPanel.test.tsx.
jest.mock(
  '../../../discovery/personal-space/Profile/tabs/access-control/AccessControlDebuggerPanel',
  () => jest.fn(() => <div data-testid="admin-permission-debugger" />)
);

describe('AdminPermissionDebugger', () => {
  it('should render the breadcrumb and the shared debugger panel', () => {
    render(
      <HelmetProvider>
        <MemoryRouter>
          <AdminPermissionDebugger />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('admin-permission-debugger')).toBeInTheDocument();
  });
});
