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
import { describe, expect, it } from 'vitest';
import { DocumentTitle } from './document-title';

describe('DocumentTitle', () => {
  it('sets document.title to the given title with the brand suffix', async () => {
    render(
      <HelmetProvider>
        <DocumentTitle title="Explore" />
      </HelmetProvider>
    );

    await waitFor(() => expect(document.title).toContain('Explore | '));
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
