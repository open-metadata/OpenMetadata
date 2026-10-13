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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReferenceBadge, SynonymBadge } from './GlossaryTermBadges';

describe('ReferenceBadge', () => {
  it.each(['https://example.com/docs', 'http://example.com'])(
    'links to the %s endpoint',
    (endpoint) => {
      render(<ReferenceBadge reference={{ name: 'docs', endpoint }} />);

      expect(screen.getByTestId('reference-link-docs')).toHaveAttribute(
        'href',
        endpoint
      );
    }
  );

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'not a url',
  ])('drops the unsafe %s endpoint from href', (endpoint) => {
    render(<ReferenceBadge reference={{ name: 'docs', endpoint }} />);

    const link = screen.getByTestId('reference-link-docs');

    expect(link).not.toHaveAttribute('href');
    expect(screen.getByText('docs')).toBeInTheDocument();
  });
});

describe('SynonymBadge', () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

  const hoverSynonym = async (text: string) => {
    // react-aria ignores hover until a pointer modality is established.
    fireEvent.mouseMove(document);
    await user.hover(screen.getByText(text));
    jest.advanceTimersByTime(500);
  };

  afterEach(() => jest.restoreAllMocks());

  it('shows the full synonym in a tooltip when it is truncated', async () => {
    jest
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(200);
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(96);
    render(<SynonymBadge synonym="gross sales adjusted" />);

    expect(screen.getByTestId('gross sales adjusted')).not.toHaveAttribute(
      'title'
    );

    await hoverSynonym('gross sales adjusted');

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'gross sales adjusted'
      )
    );
  });

  it('shows no tooltip when the synonym fits', async () => {
    render(<SynonymBadge synonym="tax" />);

    await hoverSynonym('tax');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
