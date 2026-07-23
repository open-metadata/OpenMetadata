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
import type { DataNode } from 'antd/lib/tree';
import { cloneDeep, isEmpty } from 'lodash';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_SUB_TAB,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_ROUTE_VERSION,
  ROUTES,
} from '../constants/constants';
import {
  GLOSSARY_TERMS_WIDGET,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { EntityTabs } from '../enums/entity.enum';
import type {
  KnowledgePage,
  KnowledgePageHierarchyResponse,
  PageHierarchy,
  PageSearchResult,
} from '../interface/knowledge-center.interface';
import { getEntityName } from './EntityNameUtils';
import Fqn from './Fqn';
import { t } from './i18next/LocalUtil';

export const getKnowledgePageName = (
  knowledgePage: { name?: string; displayName?: string } | undefined,
  tFn?: (key: string) => string
): string => getEntityName(knowledgePage) || (tFn ?? t)('label.untitled');

export const getKnowledgePagePath = (
  pageName: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab
    ? ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_TAB
    : ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, pageName);

  return path;
};

export const getContextCenterArticlePath = getKnowledgePagePath;

export const getContextCenterArticleVersionsPath = (
  knowledgePageName: string,
  version: string
) => {
  let path = ROUTES.CONTEXT_CENTER_ARTICLE_VERSION;
  path = path
    .replace(PLACEHOLDER_ROUTE_FQN, knowledgePageName)
    .replace(PLACEHOLDER_ROUTE_VERSION, version);

  return path;
};

export const getKnowledgeVersionsPath = (
  knowledgePageName: string,
  version: string
) => {
  let path = ROUTES.KNOWLEDGE_PAGE_VERSION;
  path = path
    .replace(PLACEHOLDER_ROUTE_FQN, knowledgePageName)
    .replace(PLACEHOLDER_ROUTE_VERSION, version);

  return path;
};

export const convertToTreeData = (
  activePage?: KnowledgePage,
  pages: PageHierarchy[] = []
) => {
  const treeData: DataNode[] = pages.map((page) => {
    const isActive = activePage?.fullyQualifiedName === page.fullyQualifiedName;
    const resolvedPage = isActive ? activePage : page;
    const title = getKnowledgePageName(resolvedPage as KnowledgePage);

    const hasChildren = !isEmpty(page?.children);
    if (!hasChildren) {
      return {
        key: page.fullyQualifiedName,
        title,
        isLeaf: page.childrenCount === 0,
      } as DataNode;
    } else {
      return {
        key: page.fullyQualifiedName,
        title,
        children: convertToTreeData(activePage, page.children),
      } as DataNode;
    }
  });

  return treeData;
};

export const findPageInTreeData = (
  pages: PageHierarchy[] = [],
  key: string
): PageHierarchy | undefined => {
  let page: PageHierarchy | undefined;

  pages.some((p) => {
    if (p.fullyQualifiedName === key) {
      page = p;

      return true;
    } else if (p?.children) {
      page = findPageInTreeData(p.children, key);

      return page !== undefined;
    }

    return false;
  });

  return page;
};

export const findPageAndParentInTreeData = (
  pages: PageHierarchy[] = [],
  key: string,
  parent?: PageHierarchy
): PageSearchResult => {
  let result: PageSearchResult = {};

  pages.some((p) => {
    if (p.fullyQualifiedName === key) {
      result.page = p;
      result.parent = parent;

      return true;
    } else if (p.children) {
      const childResult = findPageAndParentInTreeData(p.children, key, p);
      if (childResult.page) {
        result = childResult;

        return true;
      }
    }

    return false;
  });

  return result;
};

export const getPageAllChildren = (pages: PageHierarchy[] = []) => {
  const children: PageHierarchy[] = [];

  pages.forEach((p) => {
    children.push(p);
    if (p?.children) {
      children.push(...getPageAllChildren(p.children));
    }
  });

  return children;
};

export const getExpandedNodeKeys = (
  pages: PageHierarchy[] = [],
  activeKey: string
) => {
  const path: string[] = [];

  const traverse = (nodes: PageHierarchy[], currentPath: string[] = []) => {
    for (const node of nodes) {
      const newPath = [...currentPath, node.fullyQualifiedName];
      if (node.fullyQualifiedName === activeKey) {
        path.push(...newPath);

        break;
      }
      if (node?.children) {
        traverse(node.children, newPath);
      }
    }
  };

  traverse(pages);

  return path;
};

export const updateTreeData = (
  existingPages: PageHierarchy[] = [],
  newPages: PageHierarchy[],
  parentKey?: string
): PageHierarchy[] => {
  const existingPageHierarchy = cloneDeep(existingPages);

  const updateChildren = (
    pages: PageHierarchy[],
    key: string,
    children: PageHierarchy[]
  ): boolean => {
    for (const page of pages) {
      if (page.fullyQualifiedName === key) {
        if (!page.children) {
          page.children = [];
        }
        page.children.push(...children);

        return true;
      }
      if (page.children && updateChildren(page.children, key, children)) {
        return true;
      }
    }

    return false;
  };

  if (parentKey) {
    const parentFound = updateChildren(
      existingPageHierarchy,
      parentKey,
      newPages
    );
    if (!parentFound) {
      existingPageHierarchy.push(...newPages);
    }
  } else {
    existingPageHierarchy.push(...newPages);
  }

  return existingPageHierarchy;
};

export const getUpdatePageHierarchy = (
  pages: PageHierarchy[] = [],
  activePage?: KnowledgePage | PageHierarchy,
  updateChildren = false
) => {
  const newPages = cloneDeep(pages);

  const update = (nodes: PageHierarchy[]) => {
    nodes.forEach((node) => {
      if (node.fullyQualifiedName === activePage?.fullyQualifiedName) {
        if (updateChildren) {
          const children = (activePage?.children ?? []) as PageHierarchy[];
          node.children = children;
        } else {
          node.displayName = activePage?.displayName;
        }
      }
      if (node?.children) {
        update(node.children);
      }
    });
  };

  update(newPages);

  return newPages;
};

export const getUpdatePageHierarchyForDelete = (
  fullyQualifiedName: string,
  pages: PageHierarchy[] = []
) => {
  const newPages = cloneDeep(pages);

  const update = (nodes: PageHierarchy[]) => {
    nodes.forEach((node, index) => {
      if (node.fullyQualifiedName === fullyQualifiedName) {
        nodes.splice(index, 1);
      }
      if (node?.children) {
        update(node.children);
      }
    });
  };

  update(newPages);

  return newPages;
};

export type ActionType = {
  value: unknown;
  type: 'SET_PAGINATION_LOADING' | 'SET_PAGING_VALUE' | 'SET_IS_PAGINATION_END';
};

export const hierarchyPaginationInitialState = {
  paginationLoading: false,
  isPaginationEnd: false,
  paging: {
    total: 0,
    limit: 0,
    offset: 0,
  },
};

export const hierarchyPaginationReducer = (
  state = hierarchyPaginationInitialState,
  action: ActionType
): typeof hierarchyPaginationInitialState => {
  switch (action.type) {
    case 'SET_PAGINATION_LOADING':
      return { ...state, paginationLoading: action.value as boolean };

    case 'SET_PAGING_VALUE':
      return {
        ...state,
        paging: action.value as KnowledgePageHierarchyResponse['paging'],
      };

    case 'SET_IS_PAGINATION_END':
      return { ...state, isPaginationEnd: action.value as boolean };

    default:
      return state;
  }
};

export const getKnowledgePageWidgetList = () => {
  return [TAGS_WIDGET, GLOSSARY_TERMS_WIDGET];
};

export const extractKnowledgePageParentFQN = (fqn: string): string[] => {
  const fqnParts = Fqn.split(fqn);
  const parentFQN: string[] = [];

  for (let i = 1; i < fqnParts.length; i++) {
    parentFQN.push(fqnParts.slice(0, i).join(FQN_SEPARATOR_CHAR));
  }

  return parentFQN;
};

export const integrateNodesIntoHierarchy = (
  existingHierarchy: PageHierarchy[],
  nodesToIntegrate: PageHierarchy[]
): PageHierarchy[] => {
  let updatedHierarchy = [...existingHierarchy];

  const sortedNodes = nodesToIntegrate.sort((a, b) => {
    const aDepth = Fqn.split(a.fullyQualifiedName).length;
    const bDepth = Fqn.split(b.fullyQualifiedName).length;

    return aDepth - bDepth;
  });

  sortedNodes.forEach((item) => {
    const itemFqnParts = Fqn.split(item.fullyQualifiedName);

    const existingItem = findPageInTreeData(
      updatedHierarchy,
      item.fullyQualifiedName
    );

    if (!existingItem) {
      if (itemFqnParts.length > 1) {
        const parentFqn = itemFqnParts.slice(0, -1).join(FQN_SEPARATOR_CHAR);
        updatedHierarchy = updateTreeData(updatedHierarchy, [item], parentFqn);
      } else {
        updatedHierarchy.push(item);
      }
    }
  });

  return updatedHierarchy;
};
