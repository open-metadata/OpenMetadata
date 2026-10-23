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
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { usePageScrollPane } from './usePageScrollPane';

const observe = jest.fn();
const disconnect = jest.fn();

beforeAll(() => {
  // jsdom has no layout, so the observer only has to be constructible.
  global.ResizeObserver = jest.fn(() => ({
    observe,
    disconnect,
    unobserve: jest.fn(),
  })) as unknown as typeof ResizeObserver;
});

const getBar = (element: HTMLElement) =>
  element.parentElement?.querySelector<HTMLElement>('[data-testid="bar"]') ??
  null;

const Pane = ({ withBar = true }: { withBar?: boolean }) => {
  const ref = useRef<HTMLDivElement>(null);
  usePageScrollPane(ref, withBar ? getBar : undefined, 200);

  return (
    <>
      {withBar && <div data-testid="bar" />}
      <div data-testid="pane" ref={ref} />
    </>
  );
};

// A scroll container 900px tall whose top is at 20px. The bar sits at 240px
// and the pane at 300px, so the page holds 280px above the pane; the page's
// height follows the pane's, as it would once laid out.
const mountInScrollContainer = (withBar = true) => {
  const container = document.createElement('div');
  container.style.overflowY = 'auto';
  document.body.appendChild(container);
  Object.defineProperty(container, 'clientHeight', { value: 900 });
  Object.defineProperty(container, 'scrollTop', {
    value: 0,
    writable: true,
  });
  Object.defineProperty(container, 'scrollHeight', {
    get: () =>
      280 +
      parseFloat(
        container.querySelector<HTMLElement>('[data-testid="pane"]')?.style
          .height || '0'
      ),
  });
  const tops: Record<string, number> = { bar: 240, pane: 300 };
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      return { top: tops[this.dataset.testid ?? ''] ?? 20 } as DOMRect;
    });

  const result = render(<Pane withBar={withBar} />, { container });

  return { result, pane: result.getByTestId('pane'), container };
};

const wheel = (
  element: HTMLElement,
  deltaY: number,
  init: WheelEventInit = {}
) => {
  const event = new WheelEvent('wheel', { deltaY, cancelable: true, ...init });
  element.dispatchEvent(event);

  return event;
};

describe('usePageScrollPane', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('fills the container below the pinned bar and pins it', () => {
    const { pane, result } = mountInScrollContainer();

    // 900px, less the bar and the gap above the pane (300 - 240).
    expect(pane.style.height).toBe('840px');
    expect(result.getByTestId('bar').style.position).toBe('sticky');
    expect(result.getByTestId('bar').style.top).toBe('0px');
    expect(observe).toHaveBeenCalled();
  });

  it('fills the whole container without a bar', () => {
    const { pane } = mountInScrollContainer(false);

    expect(pane.style.height).toBe('900px');
  });

  it('leaves no height when nothing scrolls around it', () => {
    const { getByTestId } = render(<Pane />);

    expect(getByTestId('pane').style.height).toBe('');
  });

  it('scrolls the page, not the pane, until the page ends', () => {
    const { pane, container } = mountInScrollContainer();

    // The page can scroll 220px: until the bar, 220px down, reaches its top.
    const first = wheel(pane, 200);

    expect(first.defaultPrevented).toBe(true);
    expect(container.scrollTop).toBe(200);

    const second = wheel(pane, 200);

    expect(second.defaultPrevented).toBe(true);
    expect(container.scrollTop).toBe(220);

    // The page has ended: the pane scrolls itself.
    expect(wheel(pane, 200).defaultPrevented).toBe(false);
  });

  // A sideways swipe or Shift+wheel may be meant for a wide child.
  it('leaves a sideways or Shift scroll to the browser', () => {
    const { pane, container } = mountInScrollContainer();

    expect(wheel(pane, 20, { deltaX: 80 }).defaultPrevented).toBe(false);
    expect(wheel(pane, 120, { shiftKey: true }).defaultPrevented).toBe(false);
    expect(container.scrollTop).toBe(0);
  });

  it('leaves scrolling up to the browser', () => {
    const { pane } = mountInScrollContainer();

    expect(wheel(pane, -200).defaultPrevented).toBe(false);
  });

  it('lets go of its height, the bar and the wheel when unmounted', () => {
    const { result, pane, container } = mountInScrollContainer();
    const bar = result.getByTestId('bar');

    result.unmount();

    expect(pane.style.height).toBe('');
    expect(bar.style.position).toBe('');
    expect(disconnect).toHaveBeenCalled();
    expect(wheel(pane, 200).defaultPrevented).toBe(false);
    expect(container.scrollTop).toBe(0);
  });
});
