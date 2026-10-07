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
import { useFillAvailableHeight } from './useFillAvailableHeight';

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

const Filler = () => {
  const ref = useRef<HTMLDivElement>(null);
  useFillAvailableHeight(ref, 200);

  return <div data-testid="filler" ref={ref} />;
};

// A scroll container 900px tall whose top is at 20px, holding the filler at
// 300px: 620px of it is left below the filler's top.
const mountInScrollContainer = (overflowBelow = 0) => {
  const container = document.createElement('div');
  container.style.overflowY = 'auto';
  document.body.appendChild(container);
  Object.defineProperty(container, 'clientHeight', { value: 900 });
  Object.defineProperty(container, 'scrollTop', { value: 0 });
  // What would still overflow once the filler is sized; jsdom cannot lay out.
  Object.defineProperty(container, 'scrollHeight', {
    get: () => 900 + overflowBelow,
  });
  // Measured while rendering, so positions are in place before it.
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      return {
        top: this.dataset.testid === 'filler' ? 300 : 20,
      } as DOMRect;
    });

  const result = render(<Filler />, { container });
  const filler = result.getByTestId('filler');

  return { result, filler, container };
};

describe('useFillAvailableHeight', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('fills the container below the element', () => {
    const { filler } = mountInScrollContainer();

    expect(filler.style.height).toBe('620px');
    expect(observe).toHaveBeenCalled();
  });

  it('leaves no height when nothing scrolls around it', () => {
    const { getByTestId } = render(<Filler />);

    expect(getByTestId('filler').style.height).toBe('');
  });

  it('lets go of its height when unmounted', () => {
    const { result, filler } = mountInScrollContainer();

    result.unmount();

    expect(filler.style.height).toBe('');
    expect(disconnect).toHaveBeenCalled();
  });
});
