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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Badge, Card, Typography } from 'antd';
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

  return (
    <Card
      className={classNames('setting-card-item', className)}
      data-testid={data.key}
      onClick={handleOnClick}>
      <div className="setting-card-icon">
        <Icon component={data.icon} />
        {Boolean(data?.isBeta) && (
          <Badge className="service-beta-tag" count={t('label.beta')} />
        )}
      </div>
      <div className="setting-card-content">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
          <Typography.Text className="font-semibold">
            {data.category ?? data.label}
          </Typography.Text>
          {data.inlineBadgeKey && (
            <span className="tw:rounded-full tw:bg-brand-solid tw:px-2 tw:py-0.5 tw:text-xs tw:font-semibold tw:text-primary_on-brand">
              {t(data.inlineBadgeKey)}
            </span>
          )}
        </div>
        {data.noticeBadgeKey && (
          <span className="tw:mt-1 tw:w-max tw:rounded-full tw:border tw:border-warning tw:px-2 tw:py-0.5 tw:text-xs tw:font-medium tw:text-warning-primary">
            {t(data.noticeBadgeKey)}
          </span>
        )}
        <Typography.Paragraph
          className="font-normal text-sm"
          ellipsis={{ rows: 3 }}>
          {data.description}
        </Typography.Paragraph>
      </div>
    </Card>
  );
};

export default SettingItemCard;
