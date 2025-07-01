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
        <Typography.Text className="font-semibold">
          {data.category ?? data.label}
        </Typography.Text>
        <Typography.Paragraph
          className="font-normal text-sm"
          ellipsis={{ rows: 2 }}>
          {data.description}
        </Typography.Paragraph>
      </div>
    </Card>
  );
};

export default SettingItemCard;
