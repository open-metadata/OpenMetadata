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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { useIncrementalRender } from './useIncrementalRender';

let intersect: (() => void) | undefined;
const observe = jest.fn();

class MockIntersectionObserver {
  constructor(private cb: IntersectionObserverCallback) {
    intersect = () =>
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver
      );
  }
  observe = observe;
  disconnect = jest.fn();
  unobserve = jest.fn();
  takeRecords = jest.fn();
  root = null;
  rootMargin = '';
  thresholds = [];
}

const makeItems = (length: number, prefix = 'item') =>
  Array.from({ length }, (_, index) => `${prefix}-${index}`);

const Harness: React.FC<{ items: string[]; resetKey?: string }> = ({
  items,
  resetKey,
}) => {
  const { visibleItems, hasMore, scrollRef, sentinelRef } =
    useIncrementalRender(items, 3, resetKey);

  return (
    <div ref={scrollRef}>
      {visibleItems.map((item) => (
        <span data-testid="row" key={item}>
          {item}
        </span>
      ))}
      {hasMore && <div data-testid="sentinel" ref={sentinelRef} />}
    </div>
  );
};

describe('useIncrementalRender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    intersect = undefined;
    (
      global as unknown as { IntersectionObserver: unknown }
    ).IntersectionObserver = MockIntersectionObserver;
  });

  it('renders only the first batch', () => {
    render(<Harness items={makeItems(8)} />);

    expect(screen.getAllByTestId('row')).toHaveLength(3);
    expect(screen.getByTestId('sentinel')).toBeInTheDocument();
  });

  it('reveals the next batch when the sentinel nears the viewport', () => {
    render(<Harness items={makeItems(8)} />);

    act(() => intersect?.());

    expect(screen.getAllByTestId('row')).toHaveLength(6);

    act(() => intersect?.());

    expect(screen.getAllByTestId('row')).toHaveLength(8);
    expect(screen.queryByTestId('sentinel')).not.toBeInTheDocument();
  });

  it('observes nothing once every item is shown', () => {
    render(<Harness items={makeItems(2)} />);

    expect(screen.getAllByTestId('row')).toHaveLength(2);
    expect(observe).not.toHaveBeenCalled();
  });

  // Posting a reply re-fetches the feed; the reader keeps their place.
  it('keeps what was revealed when the same list is re-fetched', () => {
    const { rerender } = render(<Harness items={makeItems(8)} resetKey="a" />);
    act(() => intersect?.());

    rerender(<Harness items={makeItems(8, 'fresh')} resetKey="a" />);

    expect(screen.getAllByTestId('row')).toHaveLength(6);
  });

  it('starts over from the first batch when the reset key changes', () => {
    const { rerender } = render(<Harness items={makeItems(8)} resetKey="a" />);
    act(() => intersect?.());

    rerender(<Harness items={makeItems(8)} resetKey="b" />);

    expect(screen.getAllByTestId('row')).toHaveLength(3);
  });
});
