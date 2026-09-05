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
import { PageType } from '../interface/knowledge-center.interface';
import { knowledgePageToArticleItem } from './ContextCenterPureUtils';

jest.mock('./ContextCenterClassBase', () => ({
  __esModule: true,
  default: {
    getArticlePath: jest.fn((fqn: string) => `/article/${fqn}`),
  },
}));

const UNTITLED = 'Untitled';

describe('knowledgePageToArticleItem href branch', () => {
  it('uses the quick link url when the page type is QUICK_LINK', () => {
    const result = knowledgePageToArticleItem(
      {
        id: '1',
        updatedAt: 100,
        pageType: PageType.QUICK_LINK,
        page: { url: 'https://example.com' },
        fullyQualifiedName: 'ignored.fqn',
      },
      UNTITLED
    );

    expect(result.href).toBe('https://example.com');
  });

  it('returns undefined href for a QUICK_LINK page with no url', () => {
    const result = knowledgePageToArticleItem(
      {
        id: '1',
        updatedAt: 100,
        pageType: PageType.QUICK_LINK,
        page: undefined,
      },
      UNTITLED
    );

    expect(result.href).toBeUndefined();
  });

  it('derives the article path from the fqn for a non quick-link page', () => {
    const result = knowledgePageToArticleItem(
      {
        id: '1',
        updatedAt: 100,
        pageType: PageType.ARTICLE,
        fullyQualifiedName: 'ctx.page.one',
      },
      UNTITLED
    );

    expect(result.href).toBe('/article/ctx.page.one');
  });

  it('returns undefined href for a non quick-link page without a fqn', () => {
    const result = knowledgePageToArticleItem(
      {
        id: '1',
        updatedAt: 100,
        pageType: PageType.ARTICLE,
      },
      UNTITLED
    );

    expect(result.href).toBeUndefined();
  });

  it('maps tags to their last fqn segment and falls back to the untitled label', () => {
    const result = knowledgePageToArticleItem(
      {
        id: '1',
        updatedAt: 100,
        tags: [{ tagFQN: 'PII.Sensitive' }, { tagFQN: 'flat' }],
      },
      UNTITLED
    );

    expect(result.tags).toEqual([{ label: 'Sensitive' }, { label: 'flat' }]);
    expect(result.title).toBe(UNTITLED);
  });
});
