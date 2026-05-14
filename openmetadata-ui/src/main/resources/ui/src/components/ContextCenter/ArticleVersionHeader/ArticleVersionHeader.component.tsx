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
import { File06, Home02 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import contextCenterClassBase from 'utils/ContextCenterClassBase';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { KnowledgePage } from '../../../interface/knowledge-center.interface';
import { getEntityName } from '../../../utils/EntityUtils';

interface ArticleVersionHeaderProps {
  knowledgePage?: KnowledgePage;
}

const ArticleVersionHeader: FC<ArticleVersionHeaderProps> = ({
  knowledgePage,
}) => {
  const { t } = useTranslation();

  const breadcrumbs = [
    {
      name: '',
      icon: <Home02 size={14} />,
      url: '/',
      activeTitle: true,
    },
    {
      name: t('label.context-center'),
      url: contextCenterClassBase.getContextCenterPath(),
    },
    {
      name: t('label.article-plural'),
      url: contextCenterClassBase.getArticlesListPath(),
    },
    {
      activeTitle: true,
      name: getEntityName(knowledgePage) || t('label.untitled'),
      url: '',
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

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3 tw:mb-5"
      data-testid="article-version-header">
      {!breadcrumbInsideCard && (
        <TitleBreadcrumb
          useCustomArrow
          className={breadcrumbClassName}
          titleLinks={breadcrumbs}
        />
      )}

      <Card className="tw:mb-0 tw:p-6" style={cardStyle}>
        {breadcrumbInsideCard && (
          <div className="tw:mb-4">
            <TitleBreadcrumb
              useCustomArrow
              className={breadcrumbClassName}
              titleLinks={breadcrumbs}
            />
          </div>
        )}
        <div className="tw:flex tw:gap-4 tw:items-center">
          <div className="tw:w-auto tw:shrink-0 tw:bg-gray-100 tw:rounded-xl tw:flex tw:items-center tw:p-2">
            <File06
              className="tw:text-gray-500"
              height={40}
              style={{ verticalAlign: 'middle', flexShrink: 0 }}
              width={40}
            />
          </div>

          <Typography as="h3">
            {getEntityName(knowledgePage) || t('label.untitled')}
          </Typography>
        </div>
      </Card>
    </div>
  );
};

export default ArticleVersionHeader;
