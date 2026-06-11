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
import { get } from 'lodash';
import {
  KnowledgePage,
  PageType,
  QuickLink,
  RecentlyViewedQuickLinks,
  RecentViewedKnowledgePage,
} from '../interface/knowledge-center.interface';

import { File06 } from '@untitledui/icons';
import { Space } from 'antd';
import { RecentlyViewedData } from 'Models';
import { Link } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../assets/svg/external-links.svg';
import { usePersistentStorage } from '../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../hooks/useApplicationStore';
import contextCenterClassBase from './ContextCenterClassBase';
import { t } from './i18next/LocalUtil';
import { getKnowledgePageName } from './KnowledgePagePureUtils';
import { arraySorterByKey } from './RecentActivityUtils';

export {
  convertToTreeData,
  extractKnowledgePageParentFQN,
  findPageAndParentInTreeData,
  findPageInTreeData,
  getContextCenterArticlePath,
  getContextCenterArticleVersionsPath,
  getExpandedNodeKeys,
  getKnowledgePageName,
  getKnowledgePagePath,
  getKnowledgePageWidgetList,
  getKnowledgeVersionsPath,
  getPageAllChildren,
  getUpdatePageHierarchy,
  getUpdatePageHierarchyForDelete,
  hierarchyPaginationInitialState,
  hierarchyPaginationReducer,
  integrateNodesIntoHierarchy,
  updateTreeData
} from './KnowledgePagePureUtils';
export type { ActionType } from './KnowledgePagePureUtils';

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

export const getLink = (knowledgePage: KnowledgePage, testIdPrefix: string) => {
  const isQuickLink = knowledgePage.pageType === PageType.QUICK_LINK;
  const path = isQuickLink
    ? (knowledgePage.page as QuickLink).url
    : contextCenterClassBase.getArticlePath(knowledgePage.fullyQualifiedName);

  return (
    <Link
      className="no-underline text-primary text-sm"
      data-testid={`${testIdPrefix}-${
        knowledgePage.displayName || knowledgePage.fullyQualifiedName
      }`}
      key={knowledgePage.id}
      target={isQuickLink ? '_blank' : '_self'}
      to={path}>
      <Space align="baseline">
        {isQuickLink ? (
          <ExternalLinkIcon
            height={16}
            style={{ verticalAlign: 'middle' }}
            width={16}
          />
        ) : (
          <File06
            size={16}
            strokeWidth={1.5}
          />
        )}

        <span>{getKnowledgePageName(knowledgePage, t)}</span>
      </Space>
    </Link>
  );
};
