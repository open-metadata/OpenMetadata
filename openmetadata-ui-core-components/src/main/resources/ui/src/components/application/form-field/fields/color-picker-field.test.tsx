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

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ColorPickerField } from './color-picker-field';

describe('ColorPickerField', () => {
  it('renders the default palette with tokens and emits stable hex values', () => {
    const onChange = vi.fn();

    render(<ColorPickerField value="#1470EF" onChange={onChange} />);

    const firstSwatch = screen.getByRole('button', {
      name: 'Select color #1470EF',
    });

    expect(firstSwatch).toHaveStyle({
      backgroundColor: 'var(--color-entity-palette-blue)',
    });

    fireEvent.click(firstSwatch);

    expect(onChange).toHaveBeenCalledWith('#1470EF');
  });

  it('keeps custom palette colors concrete', () => {
    render(<ColorPickerField colors={['#ABCDEF']} value="#ABCDEF" />);

    expect(
      screen.getByRole('button', { name: 'Select color #ABCDEF' })
    ).toHaveStyle({ backgroundColor: '#ABCDEF' });
  });
});
