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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Typography } from 'antd';
import React from 'react';
import { NavLink } from 'react-router-dom';

interface LeftSidebarItemProps {
  data: {
    key: string;
    label: string;
    dataTestId: string;
    redirect_url?: string;
    icon: SvgComponent;
    onClick?: () => void;
  };
}

const LeftSidebarItem = ({
  data: { label, redirect_url, dataTestId, onClick, icon },
}: LeftSidebarItemProps) => {
  return redirect_url ? (
    <NavLink
      className="left-panel-item no-underline"
      data-testid={dataTestId}
      to={{
        pathname: redirect_url,
      }}>
      <div className="d-flex items-center">
        <Icon component={icon} />
        <Typography.Text className="left-panel-label">{label}</Typography.Text>
      </div>
    </NavLink>
  ) : (
    <div
      className="left-panel-item d-flex items-center"
      data-testid={dataTestId}
      onClick={onClick}>
      <Icon component={icon} />
      <Typography.Text className="left-panel-label">{label}</Typography.Text>
    </div>
  );
};

export default LeftSidebarItem;
