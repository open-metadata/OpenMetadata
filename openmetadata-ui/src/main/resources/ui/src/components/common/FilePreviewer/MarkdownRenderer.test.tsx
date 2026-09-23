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

import { render, screen, waitFor } from '@testing-library/react';
import { MAX_PREVIEW_TEXT_CHARS } from './FilePreviewer.constants';
import MarkdownRenderer from './MarkdownRenderer';

const blobOf = (s: string) => new Blob([s], { type: 'text/markdown' });

describe('MarkdownRenderer', () => {
  it('renders markdown text', async () => {
    render(<MarkdownRenderer content={blobOf('# Hello')} objectUrl="" />);

    expect(await screen.findByText('Hello')).toBeInTheDocument();
  });

  it('does not execute embedded script (no raw HTML)', async () => {
    const { container } = render(
      <MarkdownRenderer
        content={blobOf('<script>window.__pwned=1</script>text')}
        objectUrl=""
      />
    );

    await waitFor(() => expect(screen.getByText(/text/)).toBeInTheDocument());

    expect(container.querySelector('script')).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it('drops javascript: links', async () => {
    const { container } = render(
      <MarkdownRenderer
        content={blobOf('[x](javascript:alert(1))')}
        objectUrl=""
      />
    );

    await waitFor(() => expect(screen.getByText('x')).toBeInTheDocument());

    const a = container.querySelector('a');

    expect(a?.getAttribute('href') ?? '').not.toContain('javascript:');
  });

  it('truncates markdown over the cap and shows a notice', async () => {
    const overCap = 'a'.repeat(MAX_PREVIEW_TEXT_CHARS + 1);
    render(<MarkdownRenderer content={blobOf(overCap)} objectUrl="" />);

    await waitFor(() =>
      expect(
        screen.getByText('message.file-preview-text-truncated')
      ).toBeInTheDocument()
    );
  });
});
