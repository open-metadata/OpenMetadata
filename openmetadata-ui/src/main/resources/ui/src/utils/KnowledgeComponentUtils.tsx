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
import { Article, Link03 } from '@openmetadata/ui-core-components/icons';
import { lazy } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import type { KnowledgePage } from '../interface/knowledge-center.interface';
import { PageType } from '../interface/knowledge-center.interface';

const KnowledgePageSummary = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/KnowledgeCenter/KnowledgePageSummary/KnowledgePageSummary'
      )
  )
);

export const getPageIcon = (pageType: PageType) => {
  const isQuickLink = pageType === PageType.QUICK_LINK;

  return isQuickLink ? (
    <Link03 className="tw:text-utility-gray-500" size={28} />
  ) : (
    <Article size={28} />
  );
};

export const getPageSummaryComponent = (entity: KnowledgePage) => {
  return <KnowledgePageSummary entityDetails={entity} />;
};
