/*
 *  Copyright 2025 Collate.
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

import { Button, Typography } from '@openmetadata/ui-core-components';
import { Check, X } from '@untitledui/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { MetadataUploadStatusCardProps } from './MetadataUploadStatusCard.interface';

export const MetadataUploadStatusCard = ({
  status,
  fileName,
  onChangeFile,
}: MetadataUploadStatusCardProps) => {
  const { t } = useTranslation();
  const isSuccess = status === 'success';

  return (
    <div className="flex items-center justify-between p-xs metadata-upload-status-container">
      <div className="flex items-center gap-2">
        <div
          className={classNames(
            'flex-shrink flex items-center justify-center rounded-full w-6 h-6',
            {
              'metadata-upload-status-icon-success': isSuccess,
              'metadata-upload-status-icon-error': !isSuccess,
            }
          )}>
          {isSuccess ? (
            <Check className="text-white" size={16} />
          ) : (
            <X className="text-white" size={16} />
          )}
        </div>
        <Typography
          as="span"
          className="text-grey-body"
          size="text-sm"
          weight="medium">
          {t(
            isSuccess
              ? 'message.metadata-xml-file-parsed-success'
              : 'message.metadata-xml-file-parsed-error',
            { fileName }
          )}
        </Typography>
      </div>
      <Button
        color="link-color"
        data-testid="change-metadata-xml-btn"
        size="sm"
        onPress={onChangeFile}>
        {t('label.change-entity', { entity: t('label.file') })}
      </Button>
    </div>
  );
};
