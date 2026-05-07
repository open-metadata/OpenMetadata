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
import { Card } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardExpandCollapseIconButton } from '../IconButtons/EditIconButton';

interface ExpandableCardRootProps {
  title?: React.ReactNode;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}

interface ExpandableCardProps {
  children: React.ReactNode;
  defaultExpanded?: boolean;
  onExpandStateChange?: (isExpanded: boolean) => void;
  isExpandDisabled?: boolean;
  cardProps: ExpandableCardRootProps;
  dataTestId?: string;
}

const ExpandableCard = ({
  children,
  cardProps: { className, title, id, style },
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
      className={classNames(
        'new-header-border-card expandable-card tw:w-full',
        {
          expanded: isExpanded,
          collapsed: !isExpanded,
        },
        className
      )}
      data-testid={dataTestId}
      id={id}
      style={style}
      variant="default">
      <Card.Header
        className={classNames('tw:bg-secondary', {
          'tw:border-b-0': !children || !isExpanded,
        })}
        extra={
          <CardExpandCollapseIconButton
            className={classNames('expand-collapse-icon bordered', {
              'tw:rotate-0': isExpanded,
              'tw:rotate-180': !isExpanded,
            })}
            data-testid="expand-collapse-icon"
            disabled={isExpandDisabled}
            size="small"
            title={isExpanded ? t('label.collapse') : t('label.expand')}
            onClick={handleExpandClick}
          />
        }
        title={title}
      />
      {children && (
        <Card.Content
          aria-hidden={!isExpanded}
          className={classNames({
            'tw:h-0 tw:overflow-hidden tw:p-0': !isExpanded,
          })}>
          {children}
        </Card.Content>
      )}
    </Card>
  );
};

export default ExpandableCard;
