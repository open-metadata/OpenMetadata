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
import HeaderShell from './HeaderShell.component';

describe('HeaderShell', () => {
  it('renders the title', () => {
    render(<HeaderShell title="My Title" />);

    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders every optional slot when provided', () => {
    render(
      <HeaderShell
        actions={<button data-testid="actions">Add</button>}
        badge={<span data-testid="badge">BETA</span>}
        breadcrumb={<nav data-testid="breadcrumb" />}
        footer={<div data-testid="footer" />}
        leading={<span data-testid="leading" />}
        meta={<div data-testid="meta" />}
        subtitle="A subtitle"
        title="Titled"
      />
    );

    expect(screen.getByTestId('leading')).toBeInTheDocument();
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByTestId('meta')).toBeInTheDocument();
    expect(screen.getByTestId('actions')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByText('A subtitle')).toBeInTheDocument();
  });

  it('omits the actions container when no actions are passed', () => {
    render(<HeaderShell data-testid="shell" title="No Actions" />);

    expect(screen.getByTestId('shell')).toBeInTheDocument();
  });

  it('uses the default test id when none is provided', () => {
    render(<HeaderShell title="Default" />);

    expect(screen.getByTestId('header-shell')).toBeInTheDocument();
  });

  it('applies the Figma gradient on the gradient variant', () => {
    const { container } = render(
      <HeaderShell title="Gradient" variant="gradient" />
    );

    expect(container.querySelector('.tw\\:bg-gradient-to-r')).not.toBeNull();
  });
});
