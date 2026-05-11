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

import { Button, Card, Typography } from '@openmetadata/ui-core-components';
import { Plus, UploadCloud02 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ContextCenterHeaderProps } from './ContextCenterHeader.interface';

const ContextCenterHeader: FC<ContextCenterHeaderProps> = ({
  breadcrumbs,
  title,
  subtitle,
  onCreateArticle,
  onUploadFile,
  actionsSlot,
}) => {
  const { t } = useTranslation();

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
          {t('label.upload-file', { defaultValue: 'Upload File' })}
        </Button>
      )}
    </div>
  );

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-3"
      data-testid="context-center-header">
      <TitleBreadcrumb useCustomArrow titleLinks={breadcrumbs} />

      <Card className="tw:mb-5 tw:p-5">
        <div className="tw:flex tw:items-center tw:justify-between">
          <div>
            <div className="tw:mb-0.5 tw:flex tw:items-center tw:gap-2">
              <Typography as="h3">{title}</Typography>
            </div>
            {subtitle && (
              <Typography className="tw:text-gray-700" size="text-xs">
                {subtitle}
              </Typography>
            )}
          </div>
          {actionsSlot ?? defaultActions}
        </div>
      </Card>
    </div>
  );
};

export default ContextCenterHeader;
