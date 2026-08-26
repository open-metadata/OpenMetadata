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
import { render, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentTitle } from './document-title';

// `mock`-prefixed so vitest allows referencing it inside the hoisted factory.
// Whatever the host's `t('label.brand-name')` resolves to for a given test.
let mockBrand: string;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => mockBrand }),
}));

describe('DocumentTitle', () => {
  beforeEach(() => {
    mockBrand = 'OpenMetadata';
  });

  it('appends the brand suffix when the host resolves it', async () => {
    render(
      <HelmetProvider>
        <DocumentTitle title="Explore" />
      </HelmetProvider>
    );

    await waitFor(() => expect(document.title).toBe('Explore | OpenMetadata'));
  });

  it('renders no visible DOM of its own', () => {
    const { container } = render(
      <HelmetProvider>
        <DocumentTitle title="Explore" />
      </HelmetProvider>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
