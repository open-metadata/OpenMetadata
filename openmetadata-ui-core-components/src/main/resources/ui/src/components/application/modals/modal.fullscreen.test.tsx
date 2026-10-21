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
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, Modal, ModalOverlay } from './modal';

describe('Modal presentation', () => {
  it('keeps the bounded rounded dialog as its default', () => {
    render(
      <ModalOverlay isOpen>
        <Modal>
          <Dialog title="Default">
            <Dialog.Content>Content</Dialog.Content>
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
    const panel = screen.getByRole('dialog').firstElementChild;
    expect(panel).toHaveStyle({ maxWidth: '688px' });
    expect(panel).toHaveClass('tw:rounded-2xl');
    expect(screen.getByText('Content')).toHaveClass('tw:max-h-[60vh]');
  });

  it('fills the viewport with an independently scrolling body and retains keyboard dismissal', async () => {
    const close = vi.fn();
    render(
      <ModalOverlay isOpen presentation="fullscreen" onOpenChange={close}>
        <Modal>
          <Dialog dividers="scroll" title="Library">
            <Dialog.Content>Content</Dialog.Content>
          </Dialog>
        </Modal>
      </ModalOverlay>
    );
    const panel = screen.getByRole('dialog').firstElementChild;
    expect(panel).not.toHaveStyle({ maxWidth: '688px' });
    expect(panel).toHaveClass('tw:h-full');
    expect(panel).not.toHaveClass('tw:rounded-2xl');
    expect(screen.getByText('Content')).toHaveClass(
      'tw:flex-1',
      'tw:overflow-y-auto',
      'tw:min-h-0'
    );
    await userEvent.keyboard('{Escape}');
    expect(close).toHaveBeenCalledWith(false);
  });
});
