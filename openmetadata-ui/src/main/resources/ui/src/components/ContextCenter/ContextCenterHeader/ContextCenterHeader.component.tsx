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

import { Button, Input } from '@openmetadata/ui-core-components';
import { Plus, SearchMd } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as UploadIcon } from '../../../assets/svg/action-icons/upload.svg';
import contextCenterClassBase from '../../../utils/ContextCenterClassBase';
import HeaderBreadcrumb from '../../common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import HeaderShell from '../../common/HeaderShell/HeaderShell.component';
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
          iconLeading={UploadIcon}
          size="sm"
          onClick={onUploadFile}>
          {t('label.upload-file')}
        </Button>
      )}
    </div>
  );

  const breadcrumbEl = (
    <HeaderBreadcrumb noMargin items={resolvedBreadcrumbs} showHome={!isEmbedded} />
  );

  const actionsEl = (
    <div className="tw:flex tw:items-center tw:gap-3">
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
  );

  return (
    <div className='tw:mb-5' data-testid="context-center-header">
      <div className='tw:mb-3'>
        {!breadcrumbInsideCard && breadcrumbEl}
      </div>
      <HeaderShell
        actions={actionsEl}
        breadcrumb={breadcrumbInsideCard ? breadcrumbEl : undefined}
        className={className}
        padding="comfortable"
        subtitle={subtitle}
        title={title}
        variant={isEmbedded ? 'gradient' : 'flat'}
      />
    </div>
  );
};

export default ContextCenterHeader;
