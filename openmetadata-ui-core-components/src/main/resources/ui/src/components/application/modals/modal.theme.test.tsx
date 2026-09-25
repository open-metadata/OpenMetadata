import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, Modal } from './modal';

describe('Modal theme roles', () => {
  it('renders the dialog panel on the overlay surface with overlay elevation', () => {
    render(
      <Modal isOpen>
        <Dialog title="Settings">
          <Dialog.Content>Body</Dialog.Content>
          <Dialog.Footer>Footer</Dialog.Footer>
        </Dialog>
      </Modal>
    );

    const panel = screen
      .getByRole('dialog')
      .querySelector('.tw\\:bg-overlay-surface');

    expect(panel).not.toBeNull();
    expect(panel).toHaveClass('tw:bg-overlay-surface', 'tw:shadow-overlay');
    // The page background would leave the modal flush with the scrim behind it.
    expect(panel).not.toHaveClass('tw:bg-primary');
  });

  it('divides the footer with the subtle border role', () => {
    render(
      <Modal isOpen>
        <Dialog title="Settings">
          <Dialog.Content>Body</Dialog.Content>
          <Dialog.Footer>Footer</Dialog.Footer>
        </Dialog>
      </Modal>
    );

    const footer = screen
      .getByRole('dialog')
      .querySelector('.tw\\:border-t.tw\\:border-subtle');

    expect(footer).not.toBeNull();
    expect(footer).not.toHaveClass('tw:border-secondary');
  });
});
