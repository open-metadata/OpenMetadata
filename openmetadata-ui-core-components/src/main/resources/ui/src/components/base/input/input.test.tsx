/*
 *  Copyright 2024 Collate.
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
import { Input } from './input';

describe('Input', () => {
  it('renders the underlying react-aria input', () => {
    render(<Input placeholder="Enter text" />);

    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('strips script tags before bubbling onChange', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} placeholder="Enter text" />);

    fireEvent.change(screen.getByPlaceholderText('Enter text'), {
      target: { value: 'safe<script>alert(1)</script>' },
    });

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith('safe');
  });

  it('preserves entity-link syntax through sanitization', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} placeholder="Enter text" />);

    const link = '<#E::table::db.schema.tbl>';
    fireEvent.change(screen.getByPlaceholderText('Enter text'), {
      target: { value: link },
    });

    expect(handleChange).toHaveBeenCalledWith(link);
  });

  it('passes plain text through unchanged', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} placeholder="Enter text" />);

    fireEvent.change(screen.getByPlaceholderText('Enter text'), {
      target: { value: 'A plain display name' },
    });

    expect(handleChange).toHaveBeenCalledWith('A plain display name');
  });
});
