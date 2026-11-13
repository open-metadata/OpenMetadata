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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaginationDot } from './pagination-dot';

describe('PaginationDot', () => {
  it('draws compact 6px dots at the sm size', () => {
    render(<PaginationDot page={1} size="sm" total={3} />);

    const dot = screen.getByLabelText('Page 2');

    expect(dot).toHaveClass('tw:h-1.5', 'tw:w-1.5');
    expect(dot.parentElement).toHaveClass('tw:gap-2');
  });

  it('keeps the 8px md dots as the default', () => {
    render(<PaginationDot page={1} total={3} />);

    expect(screen.getByLabelText('Page 2')).toHaveClass('tw:h-2', 'tw:w-2');
  });

  it('draws a dot for every page past seven, without collapsing', () => {
    render(<PaginationDot page={1} size="sm" total={9} />);

    expect(screen.getByLabelText('Page 9')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(9);
  });

  it('marks the current page and reports the one picked', () => {
    const onPageChange = vi.fn();
    render(
      <PaginationDot page={2} size="sm" total={3} onPageChange={onPageChange} />
    );

    expect(screen.getByLabelText('Page 2')).toHaveAttribute(
      'aria-current',
      'page'
    );

    fireEvent.click(screen.getByLabelText('Page 3'));

    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
