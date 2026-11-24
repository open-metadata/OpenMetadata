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
import { MAX_PREVIEW_TEXT_CHARS } from './FilePreviewer.constants';
import TextRenderer from './TextRenderer';

describe('TextRenderer', () => {
  it('renders the full text when under the cap', async () => {
    render(<TextRenderer content={new Blob(['hello world'])} objectUrl="" />);

    expect(await screen.findByText('hello world')).toBeInTheDocument();
    expect(
      screen.queryByText('message.file-preview-text-truncated')
    ).not.toBeInTheDocument();
  });

  it('truncates text over the cap and shows a notice', async () => {
    const overCap = 'a'.repeat(MAX_PREVIEW_TEXT_CHARS + 1);
    render(<TextRenderer content={new Blob([overCap])} objectUrl="" />);

    await waitFor(() =>
      expect(
        screen.getByText('message.file-preview-text-truncated')
      ).toBeInTheDocument()
    );

    const rendered = document.querySelector('pre')?.textContent ?? '';

    expect(rendered).toHaveLength(MAX_PREVIEW_TEXT_CHARS);
  });
});
