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
  it('draws the resize grip from the semantic border token', () => {
    render(<TextAreaBase aria-label="Description" />);

    const textArea = screen.getByRole('textbox', { name: 'Description' });

    expect(textArea).toHaveClass('tw:[&::-webkit-resizer]:text-border-primary');
    expect(textArea.className).toContain(
      'tw:[&::-webkit-resizer]:bg-[linear-gradient(135deg,'
    );
    expect(textArea.className).toContain('currentColor');
    expect(textArea.className).not.toContain('tw:dark:');
  });

  // Chromium and WebKit ignore mask-* on ::-webkit-resizer and paint only its
  // background, so a masked grip renders as a solid square.
  it('does not rely on a mask for the resize grip', () => {
    render(<TextAreaBase aria-label="Description" />);

    const textArea = screen.getByRole('textbox', { name: 'Description' });

    expect(textArea.className).not.toContain('webkit-resizer]:mask');
    expect(textArea.getAttribute('style') ?? '').not.toContain('--resize');
  });
});

describe('TextAreaBase autoSize', () => {
  // jsdom has no layout, so scrollHeight is stubbed and the line metrics come
  // from inline styles.
  const renderWithContentHeight = (
    contentHeight: number,
    autoSize: Parameters<typeof TextAreaBase>[0]['autoSize']
  ) => {
    const scrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight'
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => contentHeight,
    });

    render(
      <TextAreaBase
        aria-label="Prompt"
        autoSize={autoSize}
        style={{ lineHeight: '20px', padding: 0, borderWidth: 0 }}
      />
    );

    if (scrollHeight) {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollHeight',
        scrollHeight
      );
    }

    return screen.getByRole('textbox', { name: 'Prompt' });
  };

  it('fits its height to the content', () => {
    const textArea = renderWithContentHeight(60, true);

    expect(textArea.style.height).toBe('60px');
    expect(textArea.style.overflowY).toBe('hidden');
    expect(textArea).toHaveClass('tw:resize-none');
  });

  it('never shrinks below minRows', () => {
    const textArea = renderWithContentHeight(20, { minRows: 3 });

    expect(textArea.style.height).toBe('60px');
  });

  it('stops at maxRows and scrolls', () => {
    const textArea = renderWithContentHeight(400, { maxRows: 5 });

    expect(textArea.style.height).toBe('100px');
    expect(textArea.style.overflowY).toBe('auto');
  });

  it('leaves the height alone without autoSize', () => {
    const textArea = renderWithContentHeight(400, undefined);

    expect(textArea.style.height).toBe('');
    expect(textArea).not.toHaveClass('tw:resize-none');
  });
});
