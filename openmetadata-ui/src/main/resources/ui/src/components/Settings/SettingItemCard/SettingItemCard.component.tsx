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

import { Card, Typography } from '@openmetadata/ui-core-components';
import { Badge } from 'antd';
import classNames from 'classnames';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingMenuItem } from '../../../utils/GlobalSettingsUtils';
import './setting-item-card.style.less';

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
          <SettingIcon className="tw:size-3.5 tw:shrink-0" />
          {Boolean(data?.isBeta) && (
            <Badge className="service-beta-tag" count={t('label.beta')} />
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
