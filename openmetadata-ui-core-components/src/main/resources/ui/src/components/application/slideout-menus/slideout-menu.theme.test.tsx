import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Dialog, Modal, SlideoutMenu } from './slideout-menu';

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

  it('stacks the overlay above page content that sets its own z-index', () => {
    render(
      <SlideoutMenu isOpen aria-label="Activity">
        Body
      </SlideoutMenu>
    );

    const overlay = screen.getByRole('dialog').closest('.tw\\:fixed');

    expect(overlay).toHaveClass('tw:z-50');
  });
});
