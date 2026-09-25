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
import { describe, expect, it } from 'vitest';
import { TextAreaBase } from './textarea';

describe('TextAreaBase theme semantics', () => {
  it('colors the resize handle with the active semantic border token', () => {
    render(<TextAreaBase aria-label="Description" />);

    const textArea = screen.getByRole('textbox', { name: 'Description' });

    expect(textArea).toHaveClass(
      'tw:[&::-webkit-resizer]:bg-border-primary',
      'tw:[&::-webkit-resizer]:mask-(image:--resize-handle-mask)'
    );
    expect(textArea.style.getPropertyValue('--resize-handle-mask')).toContain(
      'data:image/svg+xml;base64,'
    );
    expect(textArea.className).not.toContain('tw:dark:');
  });
});
