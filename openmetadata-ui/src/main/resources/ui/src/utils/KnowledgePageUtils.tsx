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
export {
  addToKnowledgeCenterRecentViewed,
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
  setRecentlyViewedData,
  updateKnowledgeCenterRecentViewed,
  updateTreeData,
} from './KnowledgePagePureUtils';

import { Space } from 'antd';
import { Link } from 'react-router-dom';
import { ReactComponent as ExternalLinkIcon } from '../assets/svg/external-links.svg';
import { ReactComponent as IconArticle } from '../assets/svg/ic-articles.svg';
import {
  KnowledgePage,
  PageType,
  QuickLink,
} from '../interface/knowledge-center.interface';
import contextCenterClassBase from './ContextCenterClassBase';
import { t } from './i18next/LocalUtil';
import { getKnowledgePageName } from './KnowledgePagePureUtils';

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
          <IconArticle
            height={16}
            style={{ verticalAlign: 'middle' }}
            width={16}
          />
        )}

        <span>{getKnowledgePageName(knowledgePage, t)}</span>
      </Space>
    </Link>
  );
};
