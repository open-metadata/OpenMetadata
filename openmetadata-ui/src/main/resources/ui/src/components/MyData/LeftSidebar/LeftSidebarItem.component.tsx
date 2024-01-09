/*
 *  Copyright 2023 Collate.
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
import { Badge, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { PRIMERY_COLOR } from '../../../constants/constants';

interface LeftSidebarItemProps {
  data: {
    key: string;
    label: string;
    dataTestId: string;
    redirect_url: string;
    icon: SvgComponent;
    isBeta?: boolean;
  };
}

const LeftSidebarItem = ({
  data: { key, label, icon, redirect_url, dataTestId, isBeta },
}: LeftSidebarItemProps) => {
  const { t } = useTranslation();
  const Icon = icon;

  return (
    <Tooltip
      overlayClassName="left-panel-tooltip"
      placement="right"
      title={
        <Typography.Text className="left-panel-label">{label}</Typography.Text>
      }>
      <NavLink
        className={classNames(
          'no-underline d-flex justify-center left-panel-item',
          {
            active: location.pathname.startsWith(key),
          }
        )}
        data-testid={dataTestId}
        to={{
          pathname: redirect_url,
        }}>
        {isBeta && (
          <Badge
            className="service-beta-tag m-b-xs"
            color={PRIMERY_COLOR}
            count={t('label.beta')}
            offset={[10, 0]}
            size="small"
          />
        )}
        <Icon width={30} />
      </NavLink>
    </Tooltip>
  );
};

export default LeftSidebarItem;
