import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Checkbox } from './checkbox';

const boxOf = (name: string) =>
  screen.getByText(name).closest('label')?.querySelector(':scope > div');

describe('Checkbox — box margin', () => {
  it('centres the box on the first label line by default', () => {
    render(<Checkbox label="Plain" />);

    expect(boxOf('Plain')).toHaveClass('tw:mt-0.5');
  });

  it('takes the caller box margin instead of the default for a taller first line', () => {
    render(<Checkbox boxClassName="tw:mt-1.5" label="Tall" />);

    expect(boxOf('Tall')).toHaveClass('tw:mt-1.5');
    expect(boxOf('Tall')).not.toHaveClass('tw:mt-0.5');
  });
});
