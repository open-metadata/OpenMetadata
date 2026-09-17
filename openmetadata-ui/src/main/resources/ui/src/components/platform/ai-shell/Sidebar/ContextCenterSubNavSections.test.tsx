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

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContextCenterSubNavSections from './ContextCenterSubNavSections';

jest.mock('../../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { recentlyViewedQuickLinks: [] },
  }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: undefined }),
}));

describe('ContextCenterSubNavSections', () => {
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
    const heading = container.querySelector(
      '.ask-sub-panel__section > .prose > span'
    );

    expect(heading).toHaveClass('tw:text-quaternary');
    expect(heading).not.toHaveClass('tw:text-gray-500');
  });
});
