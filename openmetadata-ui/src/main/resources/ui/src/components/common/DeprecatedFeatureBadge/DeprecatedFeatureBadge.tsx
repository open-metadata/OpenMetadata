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
    Badge,
    BadgeWithIcon,
    Box,
    Tooltip,
    Typography
} from '@openmetadata/ui-core-components';
import { InfoCircle } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';

interface DeprecatedFeatureBadgeProps {
  featureName: string;
  description?: string;
}

const DeprecatedFeatureBadge = ({
  featureName,
  description,
}: DeprecatedFeatureBadgeProps) => {
  const { t } = useTranslation();

  return (
    <Tooltip
      containerClassName="tw:max-w-100 tw:bg-primary tw:p-0"
      placement="bottom start"
      title={
        <div className="tw:break-normal" data-testid="deprecated-popover">
          <Box
            align="center"
            className="tw:border-b tw:border-secondary tw:px-5 tw:py-3"
            gap={2}>
            <InfoCircle
              aria-hidden
              className="tw:size-4 tw:text-fg-quaternary"
            />
            <Typography
              className="tw:text-primary"
              size="text-xs"
              weight="semibold">
              {t('label.about-this-feature')}
            </Typography>
          </Box>
          <Box className="tw:px-5 tw:pt-4 tw:pb-5" direction="col" gap={2}>
            <Box align="center" gap={2} wrap="wrap">
              <Typography
                className="tw:text-primary"
                size="text-sm"
                weight="regular">
                {featureName}
              </Typography>
              <Badge color="warning" size="sm">
                {t('label.deprecated')}
              </Badge>
            </Box>
            <Typography
              as="p"
              className="tw:text-tertiary"
              size="text-xs"
              weight="regular">
              {description ?? t('message.feature-deprecated-but-functional')}
            </Typography>
          </Box>
        </div>
      }
      triggerClassName="tw:rounded-full">
      <BadgeWithIcon color="warning" iconTrailing={InfoCircle} size="sm">
        {t('label.deprecated')}
      </BadgeWithIcon>
    </Tooltip>
  );
};

export default DeprecatedFeatureBadge;
