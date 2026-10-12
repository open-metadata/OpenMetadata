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
import { DrawerHeaderConfig, useDrawerHeader } from './useDrawerHeader';

const Header = (config: DrawerHeaderConfig) =>
  useDrawerHeader(config).drawerHeader;

describe('useDrawerHeader', () => {
  it('moves the default top spacing to a margin so the close button centres on the title row', () => {
    render(<Header actions={<button>action</button>} title="Title" />);

    const header = screen.getByRole('banner');

    expect(header).toHaveClass('tw:flex', 'tw:mt-6', 'tw:pt-0');
    expect(header).not.toHaveClass('tw:pt-6');
    expect(header).toContainElement(screen.getByText('action'));
  });

  it("keeps a caller's own header padding without adding the margin", () => {
    render(<Header className="tw:py-5!" title="Title" />);

    const header = screen.getByRole('banner');

    expect(header).toHaveClass('tw:flex', 'tw:py-5!');
    expect(header).not.toHaveClass('tw:mt-6');
  });
});
