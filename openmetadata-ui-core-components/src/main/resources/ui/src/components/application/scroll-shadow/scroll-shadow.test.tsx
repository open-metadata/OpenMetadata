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
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Table } from '../table/table';
import { ScrollShadow } from './scroll-shadow';

const mockScrollBox = (scrollWidth: number, clientWidth: number) => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
    scrollWidth
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
    clientWidth
  );
};

const queryShadow = (edge: 'start' | 'end') =>
  screen.queryByTestId(`scroll-shadow-${edge}`);

const scrollTo = (left: number) => {
  const scroller = screen.getByTestId('content').parentElement as HTMLElement;
  scroller.scrollLeft = left;
  fireEvent.scroll(scroller);
};

const renderScrollShadow = (endShadowClassName?: string) =>
  render(
    <ScrollShadow endShadowClassName={endShadowClassName}>
      <div data-testid="content" />
    </ScrollShadow>
  );

describe('ScrollShadow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shadows only the end edge at rest while content overflows', () => {
    mockScrollBox(900, 300);
    renderScrollShadow();

    expect(queryShadow('end')).toBeInTheDocument();
    expect(queryShadow('start')).not.toBeInTheDocument();
  });

  it('shadows both edges mid-scroll and drops the end one at the end', () => {
    mockScrollBox(900, 300);
    renderScrollShadow();

    scrollTo(300);

    expect(queryShadow('start')).toBeInTheDocument();
    expect(queryShadow('end')).toBeInTheDocument();

    scrollTo(600);

    expect(queryShadow('start')).toBeInTheDocument();
    expect(queryShadow('end')).not.toBeInTheDocument();
  });

  it('renders no shadow when the content fits', () => {
    mockScrollBox(300, 300);
    renderScrollShadow();

    expect(queryShadow('start')).not.toBeInTheDocument();
    expect(queryShadow('end')).not.toBeInTheDocument();
  });

  it('insets the end shadow before a pinned end column', () => {
    mockScrollBox(900, 300);
    renderScrollShadow('tw:right-10');

    expect(queryShadow('end')).toHaveClass('tw:right-10');
    expect(queryShadow('end')).not.toHaveClass('tw:right-0');
  });
});

describe('Table scrollShadows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const renderTable = (scrollShadows?: boolean) =>
    render(
      <Table aria-label="wide" scrollShadows={scrollShadows}>
        <Table.Header>
          <Table.Head isRowHeader id="a" label="A" />
        </Table.Header>
        <Table.Body>
          <Table.Row id="r1">
            <Table.Cell>1</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>
    );

  it('shadows an overflowing table when scrollShadows is set', () => {
    mockScrollBox(900, 300);
    renderTable(true);

    expect(queryShadow('end')).toBeInTheDocument();
  });

  it('renders no shadow by default', () => {
    mockScrollBox(900, 300);
    renderTable();

    expect(queryShadow('end')).not.toBeInTheDocument();
  });
});
