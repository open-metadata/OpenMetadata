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
import { useFillViewportHeight } from './useFillViewportHeight';

const Panel = () => {
  const { ref, height } = useFillViewportHeight<HTMLDivElement>();

  return <div data-height={height} data-testid="panel" ref={ref} />;
};

const setTop = (top: number) =>
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({ top } as DOMRect);

describe('useFillViewportHeight', () => {
  afterEach(() => jest.restoreAllMocks());

  it('fills the viewport below the element, less the bottom gap', () => {
    window.innerHeight = 900;
    setTop(286);
    render(<Panel />);

    expect(screen.getByTestId('panel')).toHaveAttribute('data-height', '598');
  });

  it('re-measures when the viewport resizes', () => {
    window.innerHeight = 900;
    setTop(286);
    render(<Panel />);

    act(() => {
      window.innerHeight = 1100;
      window.dispatchEvent(new Event('resize'));
    });

    expect(screen.getByTestId('panel')).toHaveAttribute('data-height', '798');
  });

  it('never shrinks below the minimum height', () => {
    window.innerHeight = 400;
    setTop(286);
    render(<Panel />);

    expect(screen.getByTestId('panel')).toHaveAttribute('data-height', '240');
  });
});
