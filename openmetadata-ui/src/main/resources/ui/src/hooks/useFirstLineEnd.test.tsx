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
import { useFirstLineEnd } from './useFirstLineEnd';

type Box = { top: number; bottom: number; right: number; width: number };

// jsdom does no layout, so each text node's line boxes are set by hand, in
// the order the nodes appear.
const layOut = (boxesPerTextNode: Box[][]) => {
  let call = 0;
  jest.spyOn(document, 'createRange').mockImplementation(
    () =>
      ({
        selectNodeContents: jest.fn(),
        getClientRects: () => {
          const boxes = boxesPerTextNode[call++] ?? [];

          return {
            length: boxes.length,
            item: (index: number) => boxes[index],
          };
        },
      } as unknown as Range)
  );
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ left: 100 } as DOMRect);
};

const line = (top: number, right: number, width = 50): Box => ({
  top,
  bottom: top + 20,
  right,
  width,
});

const Probe = ({ children }: { children?: React.ReactNode }) => {
  const { ref, end } = useFirstLineEnd<HTMLDivElement>();

  return (
    <div data-end={String(end)} data-testid="probe" ref={ref}>
      {children}
    </div>
  );
};

afterEach(() => jest.restoreAllMocks());

describe('useFirstLineEnd', () => {
  // "Request for <a>orders</a> table": the first line ends inside the link.
  it('ends the first line at its rightmost text, across text nodes', () => {
    layOut([[line(0, 220)], [line(0, 300), line(20, 160)], [line(20, 240)]]);
    render(
      <Probe>
        Request for <a href="/t">orders</a> table
      </Probe>
    );

    expect(screen.getByTestId('probe')).toHaveAttribute('data-end', '200');
  });

  // A web font swapping in moves the line end without resizing the element.
  it('measures again once web fonts finish loading', () => {
    const fonts = new EventTarget();
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: fonts,
    });
    layOut([[line(0, 220)], [line(0, 240)]]);
    render(<Probe>Approve orders</Probe>);

    expect(screen.getByTestId('probe')).toHaveAttribute('data-end', '120');

    act(() => {
      fonts.dispatchEvent(new Event('loadingdone'));
    });

    expect(screen.getByTestId('probe')).toHaveAttribute('data-end', '140');

    delete (document as { fonts?: unknown }).fonts;
  });

  it('has no end without text', () => {
    layOut([]);
    render(<Probe />);

    expect(screen.getByTestId('probe')).toHaveAttribute(
      'data-end',
      'undefined'
    );
  });
});
