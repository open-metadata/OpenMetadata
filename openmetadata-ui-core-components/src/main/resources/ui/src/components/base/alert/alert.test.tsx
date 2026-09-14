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
import { describe, expect, it } from 'vitest';
import { Alert } from './alert';

describe('Alert', () => {
  it('renders a title when given one', () => {
    render(<Alert title="Heads up" variant="warning" />);

    expect(screen.getByTestId('alert-title')).toHaveTextContent('Heads up');
  });

  // antd's `description`-only alerts have no heading. Requiring one here would
  // force call sites to invent user-facing copy just to migrate.
  it('omits the title element entirely when title is absent', () => {
    render(<Alert variant="brand">Body only</Alert>);

    expect(screen.queryByTestId('alert-title')).not.toBeInTheDocument();
    expect(screen.getByTestId('alert-children')).toHaveTextContent('Body only');
  });

  it('treats an empty-string title as absent', () => {
    render(
      <Alert title="" variant="brand">
        Body only
      </Alert>
    );

    expect(screen.queryByTestId('alert-title')).not.toBeInTheDocument();
  });

  // antd's `message` accepts a ReactNode, so a string-only title blocked any
  // call site that passed markup.
  it('accepts a ReactNode title', () => {
    render(
      <Alert
        title={<span data-testid="rich">rich title</span>}
        variant="error"
      />
    );

    expect(screen.getByTestId('rich')).toBeInTheDocument();
  });

  it('stacks title above body, and top-aligns the icon, only when both exist', () => {
    const { container } = render(
      <Alert title="Heading" variant="brand">
        Body
      </Alert>
    );

    expect(container.firstElementChild).toHaveClass('tw:items-start');
  });

  it('centres a body-only alert against its icon', () => {
    const { container } = render(<Alert variant="brand">Body</Alert>);

    expect(container.firstElementChild).toHaveClass('tw:items-center');
  });

  it('still centres a title-only alert', () => {
    const { container } = render(<Alert title="Heading" variant="brand" />);

    expect(container.firstElementChild).toHaveClass('tw:items-center');
  });
});
