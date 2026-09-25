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
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardExpandCollapseIconButton } from '../IconButtons/EditIconButton';

interface ExpandableCardProps {
  children: ReactNode;
  defaultExpanded?: boolean;
  onExpandStateChange?: (isExpanded: boolean) => void;
  isExpandDisabled?: boolean;
  cardProps: { className?: string; title?: ReactNode };
  dataTestId?: string;
}

// Light values reproduce the antd Card + `.new-header-border-card` look this
// replaced; the `expandable-card-*` hooks let consumers restyle the parts.
const ExpandableCard = ({
  children,
  cardProps: { className, title },
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
        'tw:w-full tw:overflow-visible tw:border-utility-gray-blue-100 tw:text-sm tw:leading-[1.5715] tw:text-primary tw:tabular-nums tw:dark:border-subtle',
        { expanded: isExpanded },
        className
      )}
      data-testid={dataTestId}>
      <div
        className={classNames(
          'expandable-card-header tw:flex tw:min-h-12 tw:items-center tw:rounded-xl tw:bg-secondary tw:px-6 tw:text-sm tw:font-medium tw:text-black/85 tw:dark:text-primary',
          {
            'tw:-mb-px tw:border-b tw:border-black/6 tw:dark:border-secondary':
              !isExpanded,
          }
        )}>
        <div className="tw:inline-block tw:flex-1 tw:overflow-hidden tw:text-ellipsis tw:whitespace-nowrap tw:py-4">
          {title}
        </div>
        <div className="expandable-card-extra tw:ml-3 tw:font-normal tw:text-primary">
          <CardExpandCollapseIconButton
            className={classNames(
              'expand-collapse-icon bordered tw:[&_svg]:fill-bg-primary',
              { 'tw:rotate-180': !isExpanded }
            )}
            data-testid="expand-collapse-icon"
            disabled={isExpandDisabled}
            size="small"
            title={isExpanded ? t('label.collapse') : t('label.expand')}
            onClick={handleExpandClick}
          />
        </div>
      </div>
      {/* `hidden` (not unmount) keeps collapsed form fields registered. */}
      <div
        className={classNames('expandable-card-body', { 'tw:p-5': children })}
        hidden={!isExpanded}>
        {children}
      </div>
    </Card>
  );
};

export default ExpandableCard;
