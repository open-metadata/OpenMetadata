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
import { Typography } from 'antd';
import classNames from 'classnames';
import React, { ReactNode } from 'react';
import './badge.style.less';

interface AppBadgeProps {
  label: string;
  icon?: ReactNode;
  color?: string;
  className?: string;
  bgColor?: string;
}

/**
 * Create Badge like component.
 * Accepts `label` as required prop
 * @param props
 * {
 *   label - Render text between Badge
 *   className -  To customize look & feel of the badge
 *   icon - Renders icon before label
 *   color - Controls color of font or Icon
 *   bgColor - Controls color of badge itself
 * }
 * @returns Badge component
 */
const AppBadge = ({
  label,
  className,
  icon,
  color,
  bgColor,
}: AppBadgeProps) => {
  return (
    <span
      className={classNames('app-badge d-flex', className)}
      data-testid="badge-container"
      style={{ color, backgroundColor: bgColor }}>
      {icon && (
        <span className="m-r-xss" data-testid="badge-icon">
          {icon}
        </span>
      )}
      <Typography.Text>{label}</Typography.Text>
    </span>
  );
};

export default AppBadge;
