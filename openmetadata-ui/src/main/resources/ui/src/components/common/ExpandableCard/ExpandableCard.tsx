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
import Icon from '@ant-design/icons';
import { Card, CardProps, Tooltip } from 'antd';
import classNames from 'classnames';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CardExpandCollapseIcon } from '../../../assets/svg/ic-card-expand-collapse.svg';

interface ExpandableCardProps {
  children: React.ReactNode;
  cardProps: CardProps;
}

const ExpandableCard = ({
  children,
  cardProps: { className, ...restCardProps },
}: ExpandableCardProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card
      className={classNames(
        'new-header-border-card w-full',
        {
          expanded: isExpanded,
        },
        className
      )}
      extra={
        <Tooltip title={isExpanded ? t('label.collapse') : t('label.expand')}>
          <Icon
            className="expand-collapse-icon"
            component={CardExpandCollapseIcon}
            style={{ fontSize: '32px', fill: 'white' }}
            onClick={() => setIsExpanded((prev) => !prev)}
          />
        </Tooltip>
      }
      {...restCardProps}>
      {children}
    </Card>
  );
};

export default ExpandableCard;
