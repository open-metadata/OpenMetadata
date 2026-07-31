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
import { describe, expect, it } from 'vitest';
import { Typography } from './typography';

describe('Typography', () => {
  it('applies no color class when color is omitted', () => {
    render(<Typography>Hello</Typography>);

    const el = screen.getByText('Hello');

    expect(el.className).not.toMatch(
      /tw:text-(tertiary|error-primary|warning-primary|success-primary)/
    );
  });

  it('applies tw:text-tertiary for color="secondary"', () => {
    render(<Typography color="secondary">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-tertiary');
  });

  it('applies tw:text-success-primary for color="success"', () => {
    render(<Typography color="success">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-success-primary');
  });

  it('applies tw:text-warning-primary for color="warning"', () => {
    render(<Typography color="warning">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-warning-primary');
  });

  it('applies tw:text-error-primary for color="danger"', () => {
    render(<Typography color="danger">Hello</Typography>);

    expect(screen.getByText('Hello')).toHaveClass('tw:text-error-primary');
  });

  it('still applies a consumer className alongside the color class', () => {
    render(
      <Typography className="tw:italic" color="secondary">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveClass('tw:text-tertiary');
    expect(el).toHaveClass('tw:italic');
  });

  it('lets a consumer className override the color class', () => {
    render(
      <Typography className="tw:text-tertiary" color="danger">
        Hello
      </Typography>
    );

    const el = screen.getByText('Hello');

    expect(el).toHaveClass('tw:text-tertiary');
    expect(el.className).not.toMatch(/tw:text-error-primary/);
  });
});
