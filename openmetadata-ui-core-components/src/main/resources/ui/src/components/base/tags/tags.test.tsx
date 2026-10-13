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

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tag, TagGroup, TagList } from './tags';

describe('Tag — keyboard focus ring', () => {
  // The Tag reserves its own `outline` for the focus ring and draws its border
  // on `::after` (see the comment in tags.tsx). `tw:focus:outline-hidden` was
  // poisoning `--tw-outline-style` to `none`, which collapses the
  // `tw:focus-visible:outline-2` ring to 0px width — a WCAG 2.4.7 violation.
  // The root class list must NOT carry it.
  it('does not carry the tw:focus:outline-hidden class that suppresses the focus ring', () => {
    render(
      <TagGroup label="Fruits">
        <TagList>
          <Tag id="apple">Apple</Tag>
        </TagList>
      </TagGroup>
    );

    const tag = screen.getByText('Apple').closest('[data-rac]') as HTMLElement;

    expect(tag).not.toHaveClass('tw:focus:outline-hidden');
  });

  it('renders the focus-visible outline classes for an accessible keyboard focus indicator', () => {
    render(
      <TagGroup label="Fruits">
        <TagList>
          <Tag id="apple">Apple</Tag>
        </TagList>
      </TagGroup>
    );

    const tag = screen.getByText('Apple').closest('[data-rac]') as HTMLElement;

    expect(tag).toHaveClass('tw:focus-visible:outline-2');
    expect(tag).toHaveClass('tw:focus-visible:outline-offset-2');
    expect(tag).toHaveClass('tw:focus-visible:outline-focus-ring');
  });

  it.each(['sm', 'md', 'lg'] as const)(
    'keeps the focus-visible ring at the %s size',
    (size) => {
      render(
        <TagGroup label="Fruits" size={size}>
          <TagList>
            <Tag id="apple">Apple</Tag>
          </TagList>
        </TagGroup>
      );

      const tag = screen
        .getByText('Apple')
        .closest('[data-rac]') as HTMLElement;

      expect(tag).toHaveClass('tw:focus-visible:outline-2');
      expect(tag).toHaveClass('tw:focus-visible:outline-offset-2');
      expect(tag).not.toHaveClass('tw:focus:outline-hidden');
    }
  );

  it('keeps the focus ring when the tag is removable', () => {
    render(
      <TagGroup label="Fruits">
        <TagList>
          <Tag id="apple" onClose={() => undefined}>
            Apple
          </Tag>
        </TagList>
      </TagGroup>
    );

    const tag = screen.getByText('Apple').closest('[data-rac]') as HTMLElement;

    expect(tag).toHaveClass('tw:focus-visible:outline-2');
    expect(tag).toHaveClass('tw:focus-visible:outline-offset-2');
    expect(tag).not.toHaveClass('tw:focus:outline-hidden');

    // The remove (X) control is a separate focusable element and must keep its
    // own focus ring too — it never carried the suppressing class. RAC rewrites
    // the remove button's accessible name via `aria-labelledby`, so scope the
    // query to the tag rather than matching by name.
    const removeButton = within(tag).getByRole('button');

    expect(removeButton).toHaveClass('tw:focus-visible:outline-2');
    expect(removeButton).toHaveClass('tw:focus-visible:outline-offset-2');
    expect(removeButton).toHaveClass('tw:focus-visible:outline-focus-ring');
    expect(removeButton).not.toHaveClass('tw:focus:outline-hidden');
  });
});
