import { render, screen } from '@testing-library/react';
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
      screen.getByRole('button', { name: 'Open menu' })
    ).toBeInTheDocument();
  });
});
