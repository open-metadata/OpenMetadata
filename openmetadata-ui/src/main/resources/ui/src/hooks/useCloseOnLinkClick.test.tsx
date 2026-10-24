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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useCloseOnLinkClick } from './useCloseOnLinkClick';

const Drawer = ({ onClose }: { onClose: () => void }) => {
  const ref = useCloseOnLinkClick<HTMLDivElement>(onClose);

  return (
    <div ref={ref}>
      <a data-testid="link" href="/glossary/Commerce">
        <span data-testid="link-text">Commerce</span>
      </a>
      <button data-testid="button">Reply</button>
    </div>
  );
};

describe('useCloseOnLinkClick', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => jest.useRealTimers());

  it('closes after a click on a link, or inside one, once the click is handled', () => {
    const onClose = jest.fn();
    render(<Drawer onClose={onClose} />);

    fireEvent.click(screen.getByTestId('link-text'));

    // Not yet: the link navigates in its own handler first.
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      jest.runAllTimers();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open for clicks that are not on a link', () => {
    const onClose = jest.fn();
    render(<Drawer onClose={onClose} />);

    fireEvent.click(screen.getByTestId('button'));
    act(() => {
      jest.runAllTimers();
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});
