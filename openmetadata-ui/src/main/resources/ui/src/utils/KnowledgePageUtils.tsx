import { ROUTES } from 'constants/constants';
import { DataNode } from 'antd/lib/tree';
import { cloneDeep, get, isEmpty } from 'lodash';
import { EntityTabs } from 'enums/entity.enum';
import {
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_SUB_TAB,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_ROUTE_VERSION,
} from '../constants/constants';
import {
  KnowledgePage,
  KnowledgePageHierarchyResponse,
  PageHierarchy,
  PageSearchResult,
  PageType,
  QuickLink,
  RecentlyViewedQuickLinks,
  RecentViewedKnowledgePage,
} from '../interface/knowledge-center.interface';

import { Space } from 'antd';
import { RecentlyViewedData } from 'Models';
import { ReactComponent as ExternalLinkIcon } from 'assets/svg/external-links.svg';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import {
  GLOSSARY_TERMS_WIDGET,
  TAGS_WIDGET,
} from 'constants/CustomizeWidgets.constants';
import { usePersistentStorage } from 'hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from 'hooks/useApplicationStore';
import { arraySorterByKey } from 'utils/CommonUtils';
import Fqn from 'utils/Fqn';
import { t } from 'utils/i18next/LocalUtil';
import { Link } from 'react-router-dom';
import { ReactComponent as IconArticle } from '../assets/svg/ic-articles.svg';
import i18n from './i18next/LocalUtil';

export const setRecentlyViewedData = (
  recentData: RecentlyViewedQuickLinks['data']
): void => {
  const currentUser = useApplicationStore.getState().currentUser;
  if (!currentUser) {
    return;
  }
  const { setUserPreference } = usePersistentStorage.getState();
  setUserPreference(currentUser.name, {
    recentlyViewedQuickLinks: recentData as unknown as RecentlyViewedData[],
  });
};

export const addToKnowledgeCenterRecentViewed = (
  eData: RecentViewedKnowledgePage
): void => {
  try {
    const entityData = { ...eData, timestamp: Date.now() };

    const currentUser = useApplicationStore.getState().currentUser;
    let recentlyViewed: RecentlyViewedQuickLinks['data'] = [];
    if (!currentUser) {
      recentlyViewed = [];
    } else {
      const { preferences } = usePersistentStorage.getState();
      recentlyViewed = get(
        preferences,
        [currentUser.name, 'recentlyViewedQuickLinks'],
        []
      ) as RecentlyViewedQuickLinks['data'];
    }
    if (recentlyViewed) {
      const arrData = recentlyViewed
        .filter(
          (item) => item.fullyQualifiedName !== entityData.fullyQualifiedName
        )
        .sort(arraySorterByKey<RecentViewedKnowledgePage>('timestamp', true));
      arrData.unshift(entityData);

      if (arrData.length > 5) {
        arrData.pop();
      }
      recentlyViewed = arrData;
    } else {
      recentlyViewed = [entityData];
    }
    setRecentlyViewedData(recentlyViewed);
  } catch (error) {
    // do not throw error
  }
};

export const updateKnowledgeCenterRecentViewed = (
  data: RecentlyViewedQuickLinks['data']
) => {
  try {
    const currentUser = useApplicationStore.getState().currentUser;
    if (!currentUser) {
      return;
    }
    const { setUserPreference } = usePersistentStorage.getState();
    setUserPreference(currentUser.name, {
      recentlyViewedQuickLinks: data as unknown as RecentlyViewedData[],
    });
  } catch (error) {
    // do not throw error
  }
};

export const getKnowledgePagePath = (
  pageName: string,
  tab?: string,
  subTab = 'all'
) => {
  let path = tab
    ? ROUTES.KNOWLEDGE_PAGE_WITH_TAB
    : ROUTES.KNOWLEDGE_PAGE;

  if (tab === EntityTabs.ACTIVITY_FEED) {
    path = ROUTES.KNOWLEDGE_PAGE_WITH_SUB_TAB;
    path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
  }

  if (tab) {
    path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
  }

  path = path.replace(PLACEHOLDER_ROUTE_FQN, pageName);

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
    const displayName = isActive ? activePage?.displayName : page.displayName;

    const hasChildren = !isEmpty(page?.children);
    if (!hasChildren) {
      return {
        key: page.fullyQualifiedName,
        title: displayName || i18n.t('label.untitled'),
        // mark the node as leaf if it has no children
        isLeaf: page.childrenCount === 0,
      } as DataNode;
    } else {
      return {
        key: page.fullyQualifiedName,
        title: displayName || i18n.t('label.untitled'),
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
    parentKey: string,
    newPages: PageHierarchy[]
  ): boolean => {
    for (const page of pages) {
      if (page.fullyQualifiedName === parentKey) {
        if (!page.children) {
          page.children = [];
        }
        page.children.push(...newPages);

        return true;
      }
      if (page.children && updateChildren(page.children, parentKey, newPages)) {
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

type ActionType = {
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

export const getLink = (knowledgePage: KnowledgePage, testIdPrefix: string) => {
  const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
  const path = isQuickLink
    ? (knowledgePage.page as QuickLink).url
    : getKnowledgePagePath(knowledgePage.fullyQualifiedName);

  return (
    <Link
      className="no-underline text-primary text-sm"
      data-testid={`${testIdPrefix}-${
        knowledgePage.displayName || knowledgePage.fullyQualifiedName
      }`}
      key={knowledgePage.id}
      target={isQuickLink ? '_blank' : '_self'}
      to={path}
    >
      <Space align="baseline">
        {isQuickLink ? (
          <ExternalLinkIcon
            height={16}
            style={{ verticalAlign: 'middle' }}
            width={16}
          />
        ) : (
          <IconArticle
            height={16}
            style={{ verticalAlign: 'middle' }}
            width={16}
          />
        )}

        <span>{knowledgePage.displayName || t('label.untitled')}</span>
      </Space>
    </Link>
  );
};

/**
 * Extracts all parent FQNs from a nested FQN
 * @param fqn - Fully qualified name (e.g., "Article_A.Article_B.Article_C")
 * @returns Array of parent FQNs (e.g., ["Article_A", "Article_A.Article_B"])
 */
export const extractKnowledgePageParentFQN = (fqn: string): string[] => {
  const fqnParts = Fqn.split(fqn);
  const parentFQN: string[] = [];

  for (let i = 1; i < fqnParts.length; i++) {
    parentFQN.push(fqnParts.slice(0, i).join(FQN_SEPARATOR_CHAR));
  }

  return parentFQN;
};

/**
 * Integrates nodes into the hierarchy by sorting them by depth and nesting under parents
 * @param existingHierarchy - Current hierarchy
 * @param nodesToIntegrate - New nodes to integrate
 * @returns Updated hierarchy with nodes properly nested
 */
export const integrateNodesIntoHierarchy = (
  existingHierarchy: PageHierarchy[],
  nodesToIntegrate: PageHierarchy[]
): PageHierarchy[] => {
  let updatedHierarchy = [...existingHierarchy];

  // Sort nodes by depth (root first, then children) to ensure proper nesting
  const sortedNodes = nodesToIntegrate.sort((a, b) => {
    const aDepth = Fqn.split(a.fullyQualifiedName).length;
    const bDepth = Fqn.split(b.fullyQualifiedName).length;

    return aDepth - bDepth;
  });

  // Integrate each node into the hierarchy
  sortedNodes.forEach((item) => {
    const itemFqnParts = Fqn.split(item.fullyQualifiedName);

    // Check if item already exists in hierarchy to avoid duplicates
    const existingItem = findPageInTreeData(
      updatedHierarchy,
      item.fullyQualifiedName
    );

    if (!existingItem) {
      if (itemFqnParts.length > 1) {
        // Nested item - find parent and add as child
        const parentFqn = itemFqnParts.slice(0, -1).join(FQN_SEPARATOR_CHAR);
        updatedHierarchy = updateTreeData(updatedHierarchy, [item], parentFqn);
      } else {
        // Root level item
        updatedHierarchy.push(item);
      }
    }
  });

  return updatedHierarchy;
};
