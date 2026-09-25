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
import { useIsTextClamped } from './useIsTextClamped';

// jsdom does no layout, so the element's box is set by hand.
const sizeElement = (scrollHeight: number, clientHeight: number) => {
  jest
    .spyOn(HTMLElement.prototype, 'scrollHeight', 'get')
    .mockReturnValue(scrollHeight);
  jest
    .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
    .mockReturnValue(clientHeight);
};

const Probe = () => {
  const { ref, isClamped } = useIsTextClamped<HTMLParagraphElement>();

  return (
    <p data-clamped={String(isClamped)} data-testid="probe" ref={ref}>
      text
    </p>
  );
};

afterEach(() => jest.restoreAllMocks());

describe('useIsTextClamped', () => {
  it('reports text cut off by the clamp', () => {
    sizeElement(80, 40);
    render(<Probe />);

    expect(screen.getByTestId('probe')).toHaveAttribute('data-clamped', 'true');
  });

  it('reports text that fits', () => {
    sizeElement(40, 40);
    render(<Probe />);

    expect(screen.getByTestId('probe')).toHaveAttribute(
      'data-clamped',
      'false'
    );
  });
});
