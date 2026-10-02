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
import { MemoryRouter } from 'react-router-dom';
import { PageType } from '../../../../interface/knowledge-center.interface';
import ContextCenterSubNavSections from './ContextCenterSubNavSections';

let mockRecentlyViewedQuickLinks: unknown[] = [];

jest.mock('../../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { recentlyViewedQuickLinks: mockRecentlyViewedQuickLinks },
  }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: undefined }),
}));

describe('ContextCenterSubNavSections', () => {
  beforeEach(() => {
    mockRecentlyViewedQuickLinks = [];
    jest.restoreAllMocks();
  });

  it('uses the semantic muted-text role for section headings', () => {
    const { container } = render(
      <MemoryRouter>
        <ContextCenterSubNavSections
          enabled={false}
          onAddQuickLink={jest.fn()}
          onCreateArticle={jest.fn()}
          onUploadFile={jest.fn()}
        />
      </MemoryRouter>
    );
    // Typography no longer wraps a span in a block-level `.prose` div — the
    // span carries `prose` itself — so the heading is a direct child here.
    const heading = container.querySelector(
      '.ask-sub-panel__section > span.prose'
    );

    expect(heading).toHaveClass('tw:text-quaternary');
    expect(heading).not.toHaveClass('tw:text-gray-500');
  });

  it('does not open a window for a javascript: quick link url (XSS guard)', () => {
    mockRecentlyViewedQuickLinks = [
      {
        fullyQualifiedName: 'ql-evil',
        name: 'Evil',
        displayName: 'Evil',
        pageType: PageType.QUICK_LINK,
        page: { url: 'javascript:alert(document.domain)' },
      },
    ];
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <MemoryRouter>
        <ContextCenterSubNavSections
          enabled={false}
          onAddQuickLink={jest.fn()}
          onCreateArticle={jest.fn()}
          onUploadFile={jest.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ask-sub-panel-link-recent-ql-evil'));

    // getSafeHttpUrl rejects the javascript: scheme, so window.open is never
    // reached — the click falls through to in-app navigation instead.
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens a new window for a safe http(s) quick link url', () => {
    mockRecentlyViewedQuickLinks = [
      {
        fullyQualifiedName: 'ql-safe',
        name: 'Docs',
        displayName: 'Docs',
        pageType: PageType.QUICK_LINK,
        page: { url: 'https://docs.open-metadata.org' },
      },
    ];
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    render(
      <MemoryRouter>
        <ContextCenterSubNavSections
          enabled={false}
          onAddQuickLink={jest.fn()}
          onCreateArticle={jest.fn()}
          onUploadFile={jest.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId('ask-sub-panel-link-recent-ql-safe'));

    expect(openSpy).toHaveBeenCalledWith(
      'https://docs.open-metadata.org',
      '_blank',
      'noopener,noreferrer'
    );
  });
});
