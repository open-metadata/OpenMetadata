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
import PageContainer from './PageContainer';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({ pathName: '/path' }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue(true),
}));

describe('Test PageContainer Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <PageContainer>
        <p>Hello world</p>
      </PageContainer>
    );

    const container = getByTestId('container');

    expect(container).toBeInTheDocument();
  });

  it('left panel containt should display if provided', () => {
    const { queryByText } = render(
      <PageContainer leftPanelContent="left panel">
        <p>Hello world</p>
      </PageContainer>
    );

    const leftPanel = queryByText(/left panel/i);

    expect(leftPanel).toBeInTheDocument();
  });
});
