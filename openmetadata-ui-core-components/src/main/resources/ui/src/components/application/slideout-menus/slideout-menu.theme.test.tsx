import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, Modal, ModalOverlay } from './slideout-menu';

describe('SlideoutMenu theme roles', () => {
  it('renders the drawer panel on the overlay surface with overlay elevation', () => {
    render(
      <Modal isOpen>
        <Dialog aria-label="Filters">Body</Dialog>
      </Modal>
    );

    const panel = screen.getByRole('dialog');

    expect(panel).toHaveClass('tw:bg-overlay-surface');
    expect(panel).not.toHaveClass('tw:bg-primary');
    // Modal wrapper owns the elevation shadow.
    expect(panel.closest('.tw\\:shadow-overlay')).not.toBeNull();
  });

  it('stacks the scrim above app chrome that carries its own z-index', () => {
    render(
      <ModalOverlay isOpen>
        <Dialog aria-label="Filters">Body</Dialog>
      </ModalOverlay>
    );

    // Without an explicit z-index the scrim is `auto`, and DOM order no longer
    // decides: a fixed nav rail or docked bar with any positive z-index paints
    // straight through it.
    const scrim = screen.getByRole('dialog').closest('.tw\\:fixed');

    expect(scrim).toHaveClass('tw:z-50');
  });
});
