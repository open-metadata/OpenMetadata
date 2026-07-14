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

import { Card, Skeleton } from '@openmetadata/ui-core-components';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getKnowledgePageName } from '../../../utils/KnowledgePagePureUtils';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';

interface ArticleVersionHeaderProps {
  knowledgePage?: KnowledgePage;
}

const ArticleVersionHeader: FC<ArticleVersionHeaderProps> = ({
  knowledgePage,
}) => {
  const { t } = useTranslation();

  const isEmbedded = contextCenterClassBase.isEmbeddedMode();

  const breadcrumbItems = [
    contextCenterClassBase.getContextCenterRootBreadcrumb(t),
    {
      label: t('label.article-plural'),
      href: contextCenterClassBase.getArticlesListPath(),
    },
    {
      label: getKnowledgePageName(knowledgePage),
    },
  ];

  if (!knowledgePage) {
    return (
      <div
        className="tw:flex tw:flex-col tw:gap-3 tw:px-6 tw:py-4"
        data-testid="article-version-header-skeleton">
        <Skeleton height={20} variant="rounded" width={300} />
        <Card className="tw:mb-0">
          <Skeleton height={28} variant="rounded" width={250} />
        </Card>
      </div>
    );
  }

  const breadcrumbInsideCard = contextCenterClassBase.isBreadcrumbInsideCard();

  const breadcrumbEl = (
    <HeaderBreadcrumb noMargin items={breadcrumbItems} showHome={!isEmbedded} />
  );

  return (
    <div className="tw:mb-5" data-testid="article-version-header">
      <div className="tw:mb-3">{!breadcrumbInsideCard && breadcrumbEl}</div>
      <HeaderShell
        breadcrumb={breadcrumbInsideCard ? breadcrumbEl : undefined}
        padding="comfortable"
        title={getKnowledgePageName(knowledgePage, t)}
        variant={isEmbedded ? 'gradient' : 'flat'}
      />
    </div>
  );
};

export default ArticleVersionHeader;
