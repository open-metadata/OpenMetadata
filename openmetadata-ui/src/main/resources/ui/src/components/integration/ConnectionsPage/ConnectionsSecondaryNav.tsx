/*
 *  Copyright 2026 Collate.
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

import { Badge, Skeleton } from '@openmetadata/ui-core-components';
import {
  BarChartSquare02,
  Brackets,
  Cube01,
  Database01,
  Dataflow03,
  HardDrive,
  LayersThree01,
  MessageSquare01,
  SearchLg,
  SearchMd,
  Server01,
  Shield01,
} from '@untitledui/icons';
import classNames from 'classnames';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  CATEGORY_CONFIGS,
  ConnectionsServiceCategory,
} from './ConnectionsPage.constants';
import { ConnectionsCategory } from './useConnectionsData';

type NavigationIcon = React.ComponentType<React.ComponentProps<'svg'>>;

const CATEGORY_ICONS: Record<ConnectionsServiceCategory, NavigationIcon> = {
  [ServiceCategory.API_SERVICES]: Brackets,
  [ServiceCategory.DASHBOARD_SERVICES]: BarChartSquare02,
  [ServiceCategory.DATABASE_SERVICES]: Database01,
  [ServiceCategory.MESSAGING_SERVICES]: MessageSquare01,
  [ServiceCategory.METADATA_SERVICES]: LayersThree01,
  [ServiceCategory.ML_MODEL_SERVICES]: Cube01,
  [ServiceCategory.PIPELINE_SERVICES]: Dataflow03,
  [ServiceCategory.STORAGE_SERVICES]: Server01,
  [ServiceCategory.SEARCH_SERVICES]: SearchMd,
  [ServiceCategory.DRIVE_SERVICES]: HardDrive,
  [ServiceCategory.SECURITY_SERVICES]: Shield01,
};

interface ConnectionsSecondaryNavProps {
  category: ConnectionsCategory;
  categoryCounts: Partial<Record<ConnectionsServiceCategory, number>>;
  total: number;
  isCountLoading?: boolean;
  onCategoryChange: (category: ConnectionsCategory) => void;
}

interface NavigationItemProps {
  count: number;
  icon: NavigationIcon;
  isActive: boolean;
  isLoading: boolean;
  label: string;
  testId: string;
  onClick: () => void;
}

const NavigationItem = ({
  count,
  icon: Icon,
  isActive,
  isLoading,
  label,
  testId,
  onClick,
}: NavigationItemProps) => (
  <button
    aria-current={isActive ? 'page' : undefined}
    className={classNames(
      'tw:mb-0.5 tw:flex tw:w-full tw:items-center tw:gap-2.5 tw:rounded-lg tw:px-3 tw:py-[9px] tw:text-left tw:transition-colors tw:cursor-pointer',
      isActive
        ? 'tw:bg-brand-primary tw:text-brand-secondary'
        : 'tw:text-secondary tw:hover:bg-secondary'
    )}
    data-testid={testId}
    type="button"
    onClick={onClick}>
    <Icon
      className={classNames(
        'tw:shrink-0',
        isActive ? 'tw:text-utility-brand-700' : 'tw:text-utility-gray-500'
      )}
      height={18}
      width={18}
    />
    <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-sm tw:font-medium tw:leading-5">
      {label}
    </span>
    {isLoading ? (
      <Skeleton height={20} variant="rounded" width={28} />
    ) : (
      <Badge
        bordered={false}
        className={classNames('tw:min-w-7 tw:justify-center tw:font-semibold', {
          'tw:bg-brand-secondary': isActive, // Need to change bg color from default brand since the container bg is also brand
        })}
        color={isActive ? 'brand' : 'gray'}
        size="sm">
        {count}
      </Badge>
    )}
  </button>
);

const ConnectionsSecondaryNav = ({
  category,
  categoryCounts,
  total,
  isCountLoading = false,
  onCategoryChange,
}: ConnectionsSecondaryNavProps) => {
  const { t } = useTranslation();

  return (
    <aside
      className="tw:w-[264px] tw:shrink-0 tw:self-stretch tw:overflow-y-auto tw:border-r tw:border-secondary tw:bg-primary tw:px-3.5 tw:pb-48 tw:pt-5"
      data-testid="connections-secondary-nav">
      <nav aria-label={t('label.connection-plural')}>
        <NavigationItem
          count={total}
          icon={SearchLg}
          isActive={category === 'all'}
          isLoading={category === 'all' && isCountLoading}
          label={t('label.all-connections')}
          testId="connections-nav-all"
          onClick={() => onCategoryChange('all')}
        />

        <div className="tw:mb-2 tw:mt-5 tw:px-3 tw:text-xs tw:font-semibold tw:leading-[18px] tw:tracking-[0.04em] tw:text-utility-gray-400 tw:uppercase">
          {t('label.browse-by-service-type')}
        </div>

        {CATEGORY_CONFIGS.map((config) => (
          <NavigationItem
            count={categoryCounts[config.key] ?? 0}
            icon={CATEGORY_ICONS[config.key]}
            isActive={category === config.key}
            isLoading={category === config.key && isCountLoading}
            key={config.key}
            label={t(config.titleKey)}
            testId={`connections-nav-${config.key}`}
            onClick={() => onCategoryChange(config.key)}
          />
        ))}
      </nav>
    </aside>
  );
};

export default ConnectionsSecondaryNav;
