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
import { render, screen, waitFor } from '@testing-library/react';
import RichTextEditorPreviewerV1 from './RichTextEditorPreviewerV1';

/**
 * End-to-end guard for the HTML-entity rendering bug.
 *
 * Deliberately does NOT mock formatClientContent or BlockEditor: the bug only
 * appears when markdown travels through the real pipeline
 * (formatClientContent -> BlockEditor -> showdown -> tiptap), so mocking either
 * end hides it.
 */
// The BlockEditor is lazy-loaded and tiptap initialises asynchronously, which
// can take well over the 1s default when the suite runs alongside others.
const RENDER_TIMEOUT = { timeout: 15000 };

describe('RichTextEditorPreviewerV1: markdown entity rendering', () => {
  it('should render > and < from code spans as real characters', async () => {
    const markdown =
      '- **Operator** (STRING, Optional) - `==` (equals), `>` (greater than), `>=` (greater or equal), `<` (less than)';

    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    );

    const container = await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    await waitFor(() => {
      expect(container.textContent).toContain('>');
    }, RENDER_TIMEOUT);

    // The user must never see the literal entity text.
    expect(container.textContent).not.toContain('&gt;');
    expect(container.textContent).not.toContain('&lt;');
    expect(container.textContent).toContain('>=');
    expect(container.textContent).toContain('<');
  });

  it('should render > and < inside a SQL code block', async () => {
    const markdown = [
      '```sql',
      'SELECT * FROM products WHERE price <= 0 OR price > 10000',
      '```',
    ].join('\n');

    render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    );

    const container = await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    await waitFor(() => {
      expect(container.textContent).toContain('price');
    }, RENDER_TIMEOUT);

    expect(container.textContent).not.toContain('&gt;');
    expect(container.textContent).not.toContain('&lt;');
    expect(container.textContent).toContain('price <= 0 OR price > 10000');
  });

  it('should not render script tags injected via markdown', async () => {
    const markdown = '# Title\n\n<script>alert(1)</script>';

    const { container } = render(
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={markdown}
      />
    );

    await screen.findByTestId('markdown-parser', {}, RENDER_TIMEOUT);

    expect(container.querySelector('script')).toBeNull();
  });
});
