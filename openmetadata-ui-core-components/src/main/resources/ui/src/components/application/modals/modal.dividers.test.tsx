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
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DialogDividers } from './modal';
import { Dialog, Modal } from './modal';

const renderDialog = (dividers?: DialogDividers) =>
  render(
    <Modal isOpen>
      <Dialog dividers={dividers} title="Settings">
        <Dialog.Content>Body</Dialog.Content>
        <Dialog.Footer>Footer</Dialog.Footer>
      </Dialog>
    </Modal>
  );

const titleDivider = () =>
  screen
    .getByRole('dialog')
    .querySelector('.tw\\:w-full.tw\\:border-t.tw\\:border-subtle');

const footer = () =>
  screen.getByText('Footer').closest('[data-divider]') as HTMLElement;

// jsdom has no layout: stub the content pane's heights to simulate overflow.
const stubContentHeights = (scrollHeight: number, clientHeight: number) => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(
    scrollHeight
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
    clientHeight
  );
};

describe('Dialog dividers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('divides the title and the footer by default', () => {
    renderDialog();

    expect(titleDivider()).not.toBeNull();
    expect(footer()).toHaveClass('tw:border-t');
  });

  it('drops both dividers in scroll mode when the content fits', () => {
    stubContentHeights(200, 200);
    renderDialog('scroll');

    expect(titleDivider()).toBeNull();
    expect(footer()).not.toHaveClass('tw:border-t');
    expect(footer()).toHaveAttribute('data-divider', 'false');
  });

  it('divides the footer in scroll mode while the content overflows', () => {
    stubContentHeights(900, 400);
    renderDialog('scroll');

    expect(titleDivider()).toBeNull();
    expect(footer()).toHaveClass('tw:border-t', 'tw:border-subtle');
    expect(footer()).toHaveAttribute('data-divider', 'true');
  });
});
