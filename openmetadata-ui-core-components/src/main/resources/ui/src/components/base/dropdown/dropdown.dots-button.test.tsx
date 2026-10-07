import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Dropdown } from './dropdown';

describe('Dropdown.DotsButton', () => {
  it('uses the accessible name the caller passes', () => {
    render(<Dropdown.DotsButton aria-label="Lineage options" />);

    expect(
      screen.getByRole('button', { name: 'Lineage options' })
    ).toBeInTheDocument();
  });

  it('falls back to a generic name when none is passed', () => {
    render(<Dropdown.DotsButton />);

    expect(
      screen.getByRole('button', { name: 'label.open-menu' })
    ).toBeInTheDocument();
  });

  it('forwards its ref to the button so popovers can anchor to it', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Dropdown.DotsButton aria-label="Lineage options" ref={ref} />);

    expect(ref.current).toBe(
      screen.getByRole('button', { name: 'Lineage options' })
    );
  });
});
