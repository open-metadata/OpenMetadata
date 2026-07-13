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
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  Article,
  KnowledgePage,
  PageHierarchy,
  PageType,
  QuickLink,
} from '../interface/knowledge-center.interface';
import {
  extractKnowledgePageParentFQN,
  findPageAndParentInTreeData,
  findPageInTreeData,
  getKnowledgePageName,
  getUpdatePageHierarchy,
  integrateNodesIntoHierarchy,
} from './KnowledgePagePureUtils';
import { getLink } from './KnowledgePageUtils';

describe('getKnowledgePageName', () => {
  it('returns displayName when present', () => {
    expect(
      getKnowledgePageName({ name: 'my-page', displayName: 'My Page' })
    ).toBe('My Page');
  });

  it('returns name when displayName is absent', () => {
    expect(getKnowledgePageName({ name: 'my-page' })).toBe('my-page');
  });

  it('returns fallback via default t when both name and displayName are absent', () => {
    expect(getKnowledgePageName({})).toBe('label.untitled');
  });

  it('returns fallback via custom tFn when both name and displayName are absent', () => {
    const tFn = (key: string) => `translated:${key}`;

    expect(getKnowledgePageName({}, tFn)).toBe('translated:label.untitled');
  });

  it('uses custom tFn fallback when knowledgePage is undefined', () => {
    const tFn = (key: string) => `translated:${key}`;

    expect(getKnowledgePageName(undefined, tFn)).toBe(
      'translated:label.untitled'
    );
  });

  it('prefers displayName over name even when tFn is provided', () => {
    const tFn = jest.fn();

    expect(
      getKnowledgePageName({ name: 'my-page', displayName: 'My Page' }, tFn)
    ).toBe('My Page');
    expect(tFn).not.toHaveBeenCalled();
  });
});

describe('KnowledgePageUtils', () => {
  it('findPageAndParentInTreeData should return the correct value', () => {
    const pages = [
      {
        fullyQualifiedName: 'a',
        children: [
          {
            fullyQualifiedName: 'b',
            children: [
              {
                fullyQualifiedName: 'c',
              },
            ],
          },
        ],
      },
    ] as PageHierarchy[];
    const key = 'c';
    const result = findPageAndParentInTreeData(pages, key);

    expect(result).toEqual({
      page: {
        fullyQualifiedName: 'c',
      },
      parent: {
        fullyQualifiedName: 'b',
        children: [
          {
            fullyQualifiedName: 'c',
          },
        ],
      },
    });
  });

  it('findPageInTreeData should return the correct value when parent is undefined', () => {
    const pages = [
      {
        fullyQualifiedName: 'a',
        children: [
          {
            fullyQualifiedName: 'b',
            children: [
              {
                fullyQualifiedName: 'c',
              },
            ],
          },
        ],
      },
    ] as PageHierarchy[];
    const key = 'a';
    const result = findPageInTreeData(pages, key);

    expect(result).toEqual({
      fullyQualifiedName: 'a',
      children: [
        {
          fullyQualifiedName: 'b',
          children: [
            {
              fullyQualifiedName: 'c',
            },
          ],
        },
      ],
    });
  });

  it('getUpdatePageHierarchy should return the updated page hierarchy', () => {
    const pages = [
      {
        fullyQualifiedName: 'a',
        children: [
          {
            fullyQualifiedName: 'b',
            children: [
              {
                fullyQualifiedName: 'c',
              },
            ],
          },
        ],
      },
    ] as PageHierarchy[];

    const updatedPage = {
      fullyQualifiedName: 'c',
      displayName: 'cDisplayName',
    } as KnowledgePage;

    const result = getUpdatePageHierarchy(pages, updatedPage);

    expect(result).toEqual([
      {
        fullyQualifiedName: 'a',
        children: [
          {
            fullyQualifiedName: 'b',
            children: [
              {
                fullyQualifiedName: 'c',
                displayName: 'cDisplayName',
              },
            ],
          },
        ],
      },
    ]);
  });

  describe('getLink', () => {
    // Wrap test component with router to support Link
    const TestWrapper: React.FC<{ children: React.ReactNode }> = ({
      children,
    }) => <BrowserRouter>{children}</BrowserRouter>;

    it('should render link for quick link page type', () => {
      const quickLinkPage: KnowledgePage = {
        id: '123',
        fullyQualifiedName: 'quicklink.test',
        displayName: 'Test Quick Link',
        pageType: PageType.QUICK_LINK,
        name: 'Test Quick Link',
        version: 1,
        updatedAt: 123456789,
        updatedBy: 'test-user',
        owners: [],
        description: 'Test Quick Link Description',
        tags: [],
        page: {
          url: 'https://example.com',
        } as QuickLink,
        href: '/api/v1/knowledgePages/123',
        deleted: false,
      };
      const testIdPrefix = 'quick-link';

      render(<TestWrapper>{getLink(quickLinkPage, testIdPrefix)}</TestWrapper>);

      const link = screen.getByTestId(
        `${testIdPrefix}-${quickLinkPage.displayName}`
      );

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.textContent).toContain('Test Quick Link');
    });

    it('should render link for knowledge page type', () => {
      const knowledgePage: KnowledgePage = {
        id: '456',
        fullyQualifiedName: 'knowledge.test',
        displayName: 'Test Knowledge Page',
        pageType: PageType.ARTICLE,
        name: 'Test Knowledge Page',
        version: 1,
        updatedAt: 123456789,
        updatedBy: 'test-user',
        page: {} as unknown as Article,
        href: '/api/v1/knowledgePages/456',
        deleted: false,
      };
      const testIdPrefix = 'knowledge-page';

      render(<TestWrapper>{getLink(knowledgePage, testIdPrefix)}</TestWrapper>);

      const link = screen.getByTestId(
        `${testIdPrefix}-${knowledgePage.displayName}`
      );

      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        '/context-center/articles/knowledge.test'
      );
      expect(link).not.toHaveAttribute('target', '_blank');
      expect(link.textContent).toContain('Test Knowledge Page');
    });

    it('should use "Untitled" when displayName is not provided', () => {
      const knowledgePage: KnowledgePage = {
        id: '789',
        fullyQualifiedName: 'knowledge.noname',
        pageType: PageType.ARTICLE,
        displayName: undefined,
        name: 'Knowledge No Name',
        version: 1,
        updatedAt: 123456789,
        updatedBy: 'test-user',
        page: {} as unknown as Article,
        href: '/api/v1/knowledgePages/789',
        deleted: false,
      };
      const testIdPrefix = 'knowledge-page';

      render(<TestWrapper>{getLink(knowledgePage, testIdPrefix)}</TestWrapper>);

      const link = screen.getByTestId(
        `${testIdPrefix}-${knowledgePage.fullyQualifiedName}`
      );

      expect(link).toBeInTheDocument();
      expect(link.textContent).toContain('Knowledge No Name');
    });

    it('should use fullyQualifiedName in test ID when displayName is not provided', () => {
      const knowledgePage: KnowledgePage = {
        id: '789',
        fullyQualifiedName: 'knowledge.noname',
        pageType: PageType.ARTICLE,
        displayName: undefined,
        name: 'Knowledge No Name',
        version: 1,
        updatedAt: 123456789,
        updatedBy: 'test-user',
        page: {} as unknown as Article,
        href: '/api/v1/knowledgePages/789',
        deleted: false,
      };
      const testIdPrefix = 'knowledge-page';

      render(<TestWrapper>{getLink(knowledgePage, testIdPrefix)}</TestWrapper>);

      const link = screen.getByTestId(
        `${testIdPrefix}-${knowledgePage.fullyQualifiedName}`
      );

      expect(link).toBeInTheDocument();
    });
  });

  describe('extractKnowledgePageParentFQN', () => {
    it('should extract parent FQNs from a nested FQN with 2 levels', () => {
      const fqn = 'Article_A.Article_B';
      const result = extractKnowledgePageParentFQN(fqn);

      expect(result).toEqual(['Article_A']);
    });

    it('should extract parent FQNs from a nested FQN with 3 levels', () => {
      const fqn = 'Article_A.Article_B.Article_C';
      const result = extractKnowledgePageParentFQN(fqn);

      expect(result).toEqual(['Article_A', 'Article_A.Article_B']);
    });

    it('should extract parent FQNs from a deeply nested FQN with 4 levels', () => {
      const fqn = 'Article_A.Article_B.Article_C.Article_D';
      const result = extractKnowledgePageParentFQN(fqn);

      expect(result).toEqual([
        'Article_A',
        'Article_A.Article_B',
        'Article_A.Article_B.Article_C',
      ]);
    });

    it('should return empty array for root level FQN', () => {
      const fqn = 'Article_A';
      const result = extractKnowledgePageParentFQN(fqn);

      expect(result).toEqual([]);
    });

    it('should handle empty string', () => {
      const fqn = '';
      const result = extractKnowledgePageParentFQN(fqn);

      expect(result).toEqual([]);
    });
  });

  describe('integrateNodesIntoHierarchy', () => {
    it('should integrate a single root level node', () => {
      const existingHierarchy: PageHierarchy[] = [];
      const nodesToIntegrate: PageHierarchy[] = [
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];

      const result = integrateNodesIntoHierarchy(
        existingHierarchy,
        nodesToIntegrate
      );

      expect(result).toHaveLength(1);
      expect(result[0].fullyQualifiedName).toBe('Article_A');
    });

    it('should integrate nested nodes under parent', () => {
      const existingHierarchy: PageHierarchy[] = [
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
        },
      ];
      const nodesToIntegrate: PageHierarchy[] = [
        {
          id: '2',
          name: 'Article_B',
          fullyQualifiedName: 'Article_A.Article_B',
          displayName: 'Article B',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];

      const result = integrateNodesIntoHierarchy(
        existingHierarchy,
        nodesToIntegrate
      );

      expect(result).toHaveLength(1);
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].fullyQualifiedName).toBe(
        'Article_A.Article_B'
      );
    });

    it('should integrate multiple levels of nodes in correct order', () => {
      const existingHierarchy: PageHierarchy[] = [];
      const nodesToIntegrate: PageHierarchy[] = [
        {
          id: '3',
          name: 'Article_C',
          fullyQualifiedName: 'Article_A.Article_B.Article_C',
          displayName: 'Article C',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
        },
        {
          id: '2',
          name: 'Article_B',
          fullyQualifiedName: 'Article_A.Article_B',
          displayName: 'Article B',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
        },
      ];

      const result = integrateNodesIntoHierarchy(
        existingHierarchy,
        nodesToIntegrate
      );

      // Should have 1 root node
      expect(result).toHaveLength(1);
      expect(result[0].fullyQualifiedName).toBe('Article_A');

      // Should have nested structure
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].fullyQualifiedName).toBe(
        'Article_A.Article_B'
      );
      expect(result[0].children?.[0].children).toHaveLength(1);
      expect(result[0].children?.[0].children?.[0].fullyQualifiedName).toBe(
        'Article_A.Article_B.Article_C'
      );
    });

    it('should not duplicate existing nodes', () => {
      const existingHierarchy: PageHierarchy[] = [
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];
      const nodesToIntegrate: PageHierarchy[] = [
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A Updated',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];

      const result = integrateNodesIntoHierarchy(
        existingHierarchy,
        nodesToIntegrate
      );

      // Should still have only 1 node, not duplicated
      expect(result).toHaveLength(1);
      // Original node should remain unchanged
      expect(result[0].displayName).toBe('Article A');
    });

    it('should handle deeply nested hierarchy (4 levels)', () => {
      const existingHierarchy: PageHierarchy[] = [];
      const nodesToIntegrate: PageHierarchy[] = [
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
        },
        {
          id: '2',
          name: 'Article_B',
          fullyQualifiedName: 'Article_A.Article_B',
          displayName: 'Article B',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
        },
        {
          id: '3',
          name: 'Article_C',
          fullyQualifiedName: 'Article_A.Article_B.Article_C',
          displayName: 'Article C',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
        },
        {
          id: '4',
          name: 'Article_D',
          fullyQualifiedName: 'Article_A.Article_B.Article_C.Article_D',
          displayName: 'Article D',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];

      const result = integrateNodesIntoHierarchy(
        existingHierarchy,
        nodesToIntegrate
      );

      // Verify the nested structure
      expect(result).toHaveLength(1);
      expect(result[0].fullyQualifiedName).toBe('Article_A');
      expect(result[0].children).toHaveLength(1);
      expect(result[0].children?.[0].fullyQualifiedName).toBe(
        'Article_A.Article_B'
      );
      expect(result[0].children?.[0].children).toHaveLength(1);
      expect(result[0].children?.[0].children?.[0].fullyQualifiedName).toBe(
        'Article_A.Article_B.Article_C'
      );
      expect(result[0].children?.[0].children?.[0].children).toHaveLength(1);
      expect(
        result[0].children?.[0].children?.[0].children?.[0].fullyQualifiedName
      ).toBe('Article_A.Article_B.Article_C.Article_D');
    });

    it('should integrate nodes into existing hierarchy without affecting other branches', () => {
      const existingHierarchy: PageHierarchy[] = [
        {
          id: '1',
          name: 'Article_A',
          fullyQualifiedName: 'Article_A',
          displayName: 'Article A',
          pageType: PageType.ARTICLE,
          childrenCount: 1,
          children: [
            {
              id: '2',
              name: 'Article_B',
              fullyQualifiedName: 'Article_A.Article_B',
              displayName: 'Article B',
              pageType: PageType.ARTICLE,
              childrenCount: 0,
            },
          ],
        },
        {
          id: '3',
          name: 'Article_X',
          fullyQualifiedName: 'Article_X',
          displayName: 'Article X',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];
      const nodesToIntegrate: PageHierarchy[] = [
        {
          id: '4',
          name: 'Article_C',
          fullyQualifiedName: 'Article_A.Article_C',
          displayName: 'Article C',
          pageType: PageType.ARTICLE,
          childrenCount: 0,
        },
      ];

      const result = integrateNodesIntoHierarchy(
        existingHierarchy,
        nodesToIntegrate
      );

      // Should have 2 root nodes
      expect(result).toHaveLength(2);
      // First root should have 2 children now
      expect(result[0].children).toHaveLength(2);
      // Second root should remain unchanged
      expect(result[1].fullyQualifiedName).toBe('Article_X');
      expect(result[1].children).toBeUndefined();
    });
  });
});
