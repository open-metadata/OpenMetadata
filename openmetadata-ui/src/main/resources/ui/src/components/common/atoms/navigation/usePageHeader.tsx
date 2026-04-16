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

import { Button, Card, Typography } from '@openmetadata/ui-core-components';
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
      <Card className="tw:mb-5 tw:p-5">
        <div className="tw:flex tw:items-center tw:justify-between">
          <div>
            <div className="tw:mb-0.5 tw:flex tw:items-center tw:gap-2">
              <Typography as="h3">{displayTitle}</Typography>
              {config.learningPageId && (
                <LearningIcon pageId={config.learningPageId} />
              )}
            </div>
            {displayDescription && (
              <Typography className="tw:text-gray-700" size="text-xs">
                {displayDescription}
              </Typography>
            )}
          </div>
          {config.actions ||
            (config.createPermission &&
              config.addButtonLabelKey &&
              config.onAddClick && (
                <Button
                  color="primary"
                  data-testid={config.addButtonTestId || 'add-entity-button'}
                  iconLeading={Plus}
                  onClick={config.onAddClick}>
                  {displayButtonLabel}
                </Button>
              ))}
        </div>
      </Card>
    ),
    [displayTitle, displayDescription, displayButtonLabel, config]
  );

  return { pageHeader };
};
