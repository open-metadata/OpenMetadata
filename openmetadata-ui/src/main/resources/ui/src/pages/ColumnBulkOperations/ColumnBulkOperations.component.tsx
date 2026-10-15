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
import {
  Badge,
  BadgeWithIcon,
  Box,
  HoverCard,
  PageLayout,
  Typography,
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useId } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import HeaderBreadcrumb from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import {
  getGlossaryHomeCrumb,
  getHomeCrumb,
} from '../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.utils';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { useIsAiMode } from '../../hooks/useAppMode';
import ColumnGrid from './ColumnGrid/ColumnGrid.component';

const ColumnBulkOperations = () => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();
  const deprecationDescriptionId = useId();

  const breadcrumbItems = [
    isAiMode ? getGlossaryHomeCrumb(t) : getHomeCrumb(t),
    { label: t('label.column-bulk-operations') },
  ];

  const deprecatedBadge = (
    <HoverCard
      className="tw:w-100 tw:max-w-[calc(100vw-2rem)] tw:p-0"
      content={
        <div data-testid="deprecated-popover">
          <Box
            align="center"
            className="tw:border-b tw:border-secondary tw:px-5 tw:py-3"
            gap={2}>
            <InfoCircle
              aria-hidden
              className="tw:size-4 tw:text-fg-quaternary"
            />
            <Typography size="text-xs" weight="semibold">
              {t('label.about-this-feature')}
            </Typography>
          </Box>
          <Box className="tw:px-5 tw:pt-4 tw:pb-5" direction="col" gap={2}>
            <Box align="center" gap={2} wrap="wrap">
              <Typography size="text-sm">
                {t('label.column-bulk-operations')}
              </Typography>
              <Badge color="warning" size="sm">
                {t('label.deprecated')}
              </Badge>
            </Box>
            <Typography as="p" color="secondary" size="text-xs">
              {t('message.feature-deprecated-but-functional')}
            </Typography>
          </Box>
        </div>
      }
      placement="bottom start">
      <AriaButton
        aria-describedby={deprecationDescriptionId}
        className="tw:cursor-default tw:rounded-full tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2"
        data-testid="deprecated-badge">
        <BadgeWithIcon color="warning" iconTrailing={InfoCircle} size="sm">
          {t('label.deprecated')}
        </BadgeWithIcon>
      </AriaButton>
      {/* The card is portalled and absent until opened, so the description is duplicated here. */}
      <span className="tw:sr-only" id={deprecationDescriptionId}>
        {t('message.feature-deprecated-but-functional')}
      </span>
    </HoverCard>
  );

  return (
    <PageLayoutV1
      pageTitle={t('label.column-bulk-operations')}
      variant={isAiMode ? 'compact' : 'default'}>
      <div
        className={classNames('tw:flex tw:flex-col', {
          'tw:gap-4': isAiMode,
        })}>
        {isAiMode ? (
          <PageLayout.PageHeader
            badge={deprecatedBadge}
            breadcrumb={
              <HeaderBreadcrumb
                noMargin
                items={breadcrumbItems}
                showHome={false}
              />
            }
            className="tw:mb-0!"
            subtitle={t('message.column-bulk-operations-subtitle')}
            title={t('label.column-bulk-operations')}
            variant="gradient"
          />
        ) : (
          <Box align="center" className="tw:mb-3" gap={2}>
            <HeaderBreadcrumb
              noMargin
              items={breadcrumbItems}
              showHome={false}
            />
            {deprecatedBadge}
          </Box>
        )}
        <ColumnGrid />
      </div>
    </PageLayoutV1>
  );
};

export default ColumnBulkOperations;
