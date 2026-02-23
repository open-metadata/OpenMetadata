/*
 *  Copyright 2024 Collate.
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
  Button as UTButton,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { ReactNode, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LearningIcon } from '../../../Learning/LearningIcon/LearningIcon.component';

interface PageHeaderConfig {
  titleKey: string;
  descriptionMessageKey: string;
  actions?: ReactNode;
  createPermission?: boolean;
  addButtonLabelKey?: string;
  addButtonTestId?: string;
  onAddClick?: () => void;
  learningPageId?: string;
}

export const usePageHeader = (config: PageHeaderConfig) => {
  const { t } = useTranslation();

  const displayTitle = t(config.titleKey);
  const displayDescription = t(config.descriptionMessageKey);
  const displayButtonLabel = config.addButtonLabelKey
    ? t(config.addButtonLabelKey)
    : '';

  const pageHeader = useMemo(
    () => (
      <div
        className="tw:bg-white tw:rounded-2xl tw:border tw:border-gray-blue-100 tw:px-5 tw:py-4 tw:mb-3 tw:flex tw:justify-between tw:items-center"
        data-testid="page-header">
        <div>
          <div className="tw:flex tw:items-center tw:gap-2 tw:mb-0.5">
            <Typography>
              <h4>{displayTitle}</h4>
            </Typography>
            {config.learningPageId && (
              <LearningIcon pageId={config.learningPageId} />
            )}
          </div>
          {displayDescription && (
            <Typography>
              <p className="tw:text-gray-500">{displayDescription}</p>
            </Typography>
          )}
        </div>
        {config.actions ||
          (config.createPermission &&
            config.addButtonLabelKey &&
            config.onAddClick && (
              <UTButton
                color="primary"
                data-testid={config.addButtonTestId || 'add-entity-button'}
                iconLeading={<Plus size={16} />}
                size="md"
                onClick={config.onAddClick}>
                {displayButtonLabel}
              </UTButton>
            ))}
      </div>
    ),
    [displayTitle, displayDescription, displayButtonLabel, config]
  );

  return { pageHeader };
};
