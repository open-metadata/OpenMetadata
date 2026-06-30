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

import {
  Button,
  Card,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus, SearchMd, UploadCloud02 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { ContextCenterHeaderProps } from './ContextCenterHeader.interface';

const ContextCenterHeader: FC<ContextCenterHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  className = '',
  hasPermission = true,
  onCreateArticle,
  onUploadFile,
  actionsSlot,
  searchQuery,
  searchPlaceholder,
  onSearch,
}) => {
  const { t } = useTranslation();
  const breadcrumbInsideCard = contextCenterClassBase.isBreadcrumbInsideCard();
  const cardStyle = contextCenterClassBase.getCardStyle();
  const isEmbedded = contextCenterClassBase.isEmbeddedMode();

  const resolvedBreadcrumbs = [
    contextCenterClassBase.getContextCenterRootBreadcrumb(t),
    ...breadcrumbs,
  ];

  const defaultActions = (
    <div className="tw:flex tw:items-center tw:gap-3 tw:shrink-0">
      {onCreateArticle && (
        <Button
          color="secondary"
          iconLeading={Plus}
          size="sm"
          onClick={onCreateArticle}>
          {t('label.create-entity', { entity: t('label.article') })}
        </Button>
      )}
      {onUploadFile && (
        <Button
          color="primary"
          iconLeading={UploadCloud02}
          size="sm"
          onClick={onUploadFile}>
          {t('label.upload-file')}
        </Button>
      )}
    </div>
  );

  const breadcrumbEl = (
    <HeaderBreadcrumb
      items={resolvedBreadcrumbs}
      showHome={!isEmbedded}
    />
  );

  return (
    <div className="tw:flex tw:flex-col" data-testid="context-center-header">
      {!breadcrumbInsideCard && breadcrumbEl}

      <Card className={`tw:mb-5 tw:p-5 ${className}`} style={cardStyle}>
        {breadcrumbInsideCard && <div className="tw:mb-4">{breadcrumbEl}</div>}
        <div className="tw:flex tw:items-center tw:justify-between tw:gap-4">
          <div>
            <div className="tw:mb-0.5 tw:flex tw:items-center tw:gap-2">
              <Typography as="h3">{title}</Typography>
            </div>
            {subtitle && (
              <Typography className="tw:text-secondary">{subtitle}</Typography>
            )}
          </div>
          <div className="tw:flex tw:items-center tw:gap-3 tw:ml-auto tw:shrink-0">
            {onSearch && (
              <Input
                data-testid="search-input"
                icon={SearchMd}
                inputClassName="tw:w-75"
                placeholder={searchPlaceholder}
                value={searchQuery ?? ''}
                onChange={onSearch}
              />
            )}
            {hasPermission ? actionsSlot ?? defaultActions : null}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ContextCenterHeader;
