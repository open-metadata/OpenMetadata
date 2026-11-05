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

import { Badge, Box, Card, Typography } from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';
import './setting-item-card.style.less';

// Sized and tinted to match the 90px tiles baked into the legacy colored SVGs.
const ICON_TILE_COLORS: Record<
  NonNullable<SettingMenuItem['iconColor']>,
  string
> = {
  blue: 'tw:bg-utility-blue-50 tw:text-utility-blue-700',
  green: 'tw:bg-utility-success-50 tw:text-utility-success-700',
};

interface SettingMenuItemProps {
  data: SettingMenuItem;
  onClick: (key: string) => void;
  className?: string;
}

const SettingItemCard = ({
  data,
  onClick,
  className,
}: SettingMenuItemProps) => {
  const { t } = useTranslation();
  const handleOnClick = useCallback(
    () => onClick(data.key),
    [onClick, data.key]
  );

  const SettingIcon = data.icon;

  return (
    <Card
      className={classNames('setting-card-item', className)}
      data-testid={data.key}
      onClick={handleOnClick}>
      <Card.Content className="tw:flex tw:items-center tw:gap-4">
        <div className="setting-card-icon">
          {data.iconColor ? (
            <Box
              align="center"
              className={classNames(
                'tw:size-22.5 tw:rounded-[28px]',
                ICON_TILE_COLORS[data.iconColor]
              )}
              justify="center">
              <SettingIcon className="tw:size-8" />
            </Box>
          ) : (
            /* antd's <Icon> wrapper carried `vertical-align: -0.125em` from
               `.anticon`. A bare <svg> is baseline-aligned inline, which makes
               the icon box 2px taller and shifts every settings card down the
               page, so keep that alignment here. */
            <SettingIcon className="tw:size-[90px] tw:shrink-0 tw:align-[-0.125em]" />
          )}
          {Boolean(data?.isBeta) && (
            <Badge className="service-beta-tag" color="brand" size="sm">
              {t('label.beta')}
            </Badge>
          )}
        </div>
        <div className="setting-card-content">
          <Typography className="setting-card-title font-semibold">
            {data.category ?? data.label}
          </Typography>
          <Typography
            as="p"
            className="setting-card-description font-normal text-sm"
            ellipsis={{ rows: 2 }}>
            {data.description}
          </Typography>
        </div>
      </Card.Content>
    </Card>
  );
};

export default SettingItemCard;
