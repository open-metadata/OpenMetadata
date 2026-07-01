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

import { Card, Skeleton, Typography } from '@openmetadata/ui-core-components';
import { File06 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import { getKnowledgePageName } from '../../../utils/KnowledgePagePureUtils';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';

interface ArticleVersionHeaderProps {
  knowledgePage?: KnowledgePage;
}

const ArticleVersionHeader: FC<ArticleVersionHeaderProps> = ({
  knowledgePage,
}) => {
  const { t } = useTranslation();

  const breadcrumbItems = [
    {
      label: t('label.context-center'),
      href: contextCenterClassBase.getContextCenterPath(),
    },
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
  const cardStyle = contextCenterClassBase.getCardStyle();
  const breadcrumbClassName = contextCenterClassBase.getBreadcrumbClassName();

  const breadcrumbEl = (
    <HeaderBreadcrumb
      showHome
      className={breadcrumbClassName}
      items={breadcrumbItems}
    />
  );

  return (
    <div
      className="tw:flex tw:flex-col tw:mb-5"
      data-testid="article-version-header">
      {!breadcrumbInsideCard && breadcrumbEl}

      <Card className="tw:mb-0 tw:p-6" style={cardStyle}>
        {breadcrumbInsideCard && <div className="tw:mb-4">{breadcrumbEl}</div>}
        <div className="tw:flex tw:gap-4 tw:items-center">
          <div className="tw:w-auto tw:shrink-0 tw:bg-tertiary tw:rounded-xl tw:flex tw:items-center tw:p-2">
            <File06
              className="tw:text-quaternary"
              height={40}
              strokeWidth={1.2}
              style={{ verticalAlign: 'middle', flexShrink: 0 }}
              width={40}
            />
          </div>

          <Typography as="h3">
            {getKnowledgePageName(knowledgePage, t)}
          </Typography>
        </div>
      </Card>
    </div>
  );
};

export default ArticleVersionHeader;
