/*
 *  Copyright 2026 Collate.
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
import { DrawerBodyConfig, useDrawerBody } from './useDrawerBody';

const Body = (config: DrawerBodyConfig) => useDrawerBody(config).drawerBody;

describe('useDrawerBody', () => {
  it('renders the loading overlay outside the scrolling content so it covers the whole drawer', () => {
    render(<Body loading>content</Body>);

    const content = screen.getByRole('main');

    expect(content).toHaveTextContent('content');
    expect(content).not.toContainElement(screen.getByTestId('loader'));
  });

  it('renders no overlay when not loading', () => {
    render(<Body>content</Body>);

    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });
});
