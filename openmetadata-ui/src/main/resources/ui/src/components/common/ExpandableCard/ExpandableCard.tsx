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
import { Card, CardProps } from 'antd';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardExpandCollapseIconButton } from '../IconButtons/EditIconButton';

interface ExpandableCardProps {
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onExpandStateChange?: (isExpanded: boolean) => void;
  isExpandDisabled?: boolean;
  cardProps: CardProps;
  dataTestId?: string;
}

const ExpandableCard = ({
  children,
  cardProps: { className, ...restCardProps },
  onExpandStateChange,
  isExpandDisabled,
  dataTestId,
  defaultExpanded = true,
}: ExpandableCardProps) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleExpandClick = useCallback(() => {
    setIsExpanded((prev) => {
      onExpandStateChange?.(prev);

      return !prev;
    });
  }, [onExpandStateChange]);

  useEffect(() => {
    setIsExpanded(defaultExpanded);
  }, [defaultExpanded]);

  return (
    <Card
      bodyStyle={{
        // This will prevent the card body from having padding when there is no content
        padding: children ? undefined : '0px',
      }}
      className={classNames(
        'new-header-border-card w-full',
        {
          expanded: isExpanded,
        },
        className
      )}
      data-testid={dataTestId}
      extra={
        <CardExpandCollapseIconButton
          className="expand-collapse-icon bordered"
          disabled={isExpandDisabled}
          size="small"
          title={isExpanded ? t('label.collapse') : t('label.expand')}
          onClick={handleExpandClick}
        />
      }
      {...restCardProps}>
      {children}
    </Card>
  );
};

export default ExpandableCard;
