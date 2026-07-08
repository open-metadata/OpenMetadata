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
  Badge,
  Button,
  Card,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { Plus } from '@untitledui/icons';
import { startCase } from 'lodash';
import { FC, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { LearningIcon } from '../../../Learning/LearningIcon/LearningIcon.component';
import HeaderShell from '../../HeaderShell/HeaderShell.component';
import ProfilePicture from '../../ProfilePicture/ProfilePicture';

export type PageHeaderVariant = 'default' | 'greeting' | 'search' | 'beta';

interface PageHeaderConfig {
  titleKey: string;
  descriptionMessageKey: string;
  actions?: ReactNode;
  createPermission?: boolean;
  addButtonLabelKey?: string;
  addButtonTestId?: string;
  onAddClick?: () => void;
  learningPageId?: string;
  /**
   * Visual variant. Defaults to 'default', which renders the original card
   * header unchanged. 'greeting' | 'search' | 'beta' render through HeaderShell.
   */
  variant?: PageHeaderVariant;
  /** Leading icon for search/beta/default variants; wrapped in a FeaturedIcon tile. */
  icon?: FC<{ className?: string }> | ReactNode;
  iconColor?: 'brand' | 'gray' | 'success' | 'warning' | 'error';
  /** Inline search node (usually from useSearch) rendered in search/beta variants. */
  search?: ReactNode;
  /** Breadcrumb row rendered above the title in HeaderShell variants. */
  breadcrumb?: ReactNode;
  /** i18n key for the greeting title. Defaults to 'label.hey-comma-name'. */
  greetingNameKey?: string;
  /** i18n key for the beta badge label. Defaults to 'label.beta'. */
  betaLabelKey?: string;
}

export const usePageHeader = (config: PageHeaderConfig) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();

  const variant = config.variant ?? 'default';
  const displayTitle = t(config.titleKey);
  const displayDescription = t(config.descriptionMessageKey);
  const displayButtonLabel = config.addButtonLabelKey
    ? t(config.addButtonLabelKey)
    : '';

  const addButton =
    config.createPermission && config.addButtonLabelKey && config.onAddClick ? (
      <Button
        color="primary"
        data-testid={config.addButtonTestId || 'add-entity-button'}
        iconLeading={Plus}
        onClick={config.onAddClick}>
        {displayButtonLabel}
      </Button>
    ) : null;

  const pageHeader = ((): ReactNode => {
    if (variant === 'default') {
      return (
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
                <Typography className="tw:text-secondary" size="text-xs">
                  {displayDescription}
                </Typography>
              )}
            </div>
            {config.actions || addButton}
          </div>
        </Card>
      );
    }

    const isGreeting = variant === 'greeting';
    const showSearch = variant === 'search' || variant === 'beta';
    const greetingName = startCase(
      currentUser?.displayName || currentUser?.name || ''
    );

    const leading = isGreeting ? (
      <ProfilePicture
        displayName={currentUser?.displayName}
        name={currentUser?.name ?? ''}
        width="48"
      />
    ) : config.icon ? (
      <FeaturedIcon
        color={config.iconColor ?? 'brand'}
        icon={config.icon}
        shape="square"
        size="md"
        theme="gradient"
      />
    ) : undefined;

    const title = isGreeting
      ? t(config.greetingNameKey ?? 'label.hey-comma-name', {
          name: greetingName,
        })
      : displayTitle;

    const betaBadge =
      variant === 'beta' ? (
        <Badge color="brand" size="sm" type="color">
          {t(config.betaLabelKey ?? 'label.beta')}
        </Badge>
      ) : null;

    const learningIcon = config.learningPageId ? (
      <LearningIcon pageId={config.learningPageId} />
    ) : null;

    const badge =
      betaBadge || learningIcon ? (
        <>
          {betaBadge}
          {learningIcon}
        </>
      ) : undefined;

    const actions = isGreeting ? undefined : (
      <>
        {showSearch && config.search}
        {config.actions ?? addButton}
      </>
    );

    return (
      <HeaderShell
        actions={actions}
        badge={badge}
        breadcrumb={config.breadcrumb}
        data-testid="page-header-container"
        leading={leading}
        subtitle={displayDescription}
        title={title}
        variant="gradient"
      />
    );
  })();

  return { pageHeader };
};
