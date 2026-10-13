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
  Box,
  Button,
  Card,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { kebabCase } from 'lodash';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { getTextFromHtmlString } from '../../../../../../utils/BlockEditorPureUtils';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';

interface ApplicationCardProps {
  appName: string;
  title: string;
  description?: string;
  /**
   * Renders a link button that opens the app instead of making the whole card
   * a button (a button inside a button is not valid markup).
   */
  actionLabel?: string;
  /** Shows the "Disabled" badge; the card stays clickable so it can be restored. */
  isDisabled?: boolean;
  /** When set the card is not clickable and the reason shows as a tooltip. */
  unavailableReason?: string;
  onClick: () => void;
}

const ApplicationCard: FC<ApplicationCardProps> = ({
  appName,
  title,
  description,
  actionLabel,
  isDisabled = false,
  unavailableReason,
  onClick,
}) => {
  const { t } = useTranslation();
  const Icon = applicationsClassBase.getAppIcon(appName);
  const isAvailable = !unavailableReason;
  const isClickable = isAvailable && !actionLabel;

  const card = (
    <Card
      aria-disabled={!isAvailable || undefined}
      className={classNames('tw:h-full', { 'tw:opacity-65': !isAvailable })}
      data-testid={`${kebabCase(appName)}-card`}
      isClickable={isClickable}
      role={isClickable ? 'button' : undefined}
      size="md"
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}>
      <Card.Content>
        <Box align="start" direction="row" gap={4}>
          <Box
            align="center"
            className="tw:size-10 tw:shrink-0 tw:rounded-lg tw:bg-secondary"
            justify="center">
            <Icon className="tw:size-5 tw:text-fg-secondary" />
          </Box>
          <Box className="tw:min-w-0" direction="col" gap={1}>
            <Box align="center" direction="row" gap={2} wrap="wrap">
              <Typography
                className="tw:text-primary"
                size="text-md"
                weight="semibold">
                {title}
              </Typography>
              {isDisabled && (
                <Badge
                  color="gray"
                  data-testid="disabled-badge"
                  size="sm"
                  type="pill-color">
                  {t('label.disabled')}
                </Badge>
              )}
            </Box>
            {description && (
              <Typography
                className="tw:line-clamp-3 tw:text-tertiary"
                size="text-sm">
                {getTextFromHtmlString(description)}
              </Typography>
            )}
            {actionLabel && (
              <Button
                noTextPadding
                className="tw:self-start"
                color="link-color"
                data-testid="config-btn"
                isDisabled={!isAvailable}
                size="sm"
                onPress={onClick}>
                {actionLabel}
              </Button>
            )}
          </Box>
        </Box>
      </Card.Content>
    </Card>
  );

  if (unavailableReason) {
    return (
      <Tooltip
        excludeTriggerFromTabOrder
        placement="top"
        title={unavailableReason}
        triggerClassName="tw:block tw:h-full">
        {card}
      </Tooltip>
    );
  }

  return card;
};

export default ApplicationCard;
