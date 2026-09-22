/*
 *  Copyright 2025 Collate.
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
import {
  Badge,
  BadgeWithIcon,
  FeaturedIcon,
} from '@openmetadata/ui-core-components';
import { ChevronRight } from '@untitledui/icons';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ASSET_HEALTH_TONE_COLOR } from './AssetHealthWidget.constant';
import { AssetHealthRowItemProps } from './AssetHealthWidget.interface';

const AssetHealthRowItem = ({ row, onCtaClick }: AssetHealthRowItemProps) => {
  const { t } = useTranslation();
  const RowIcon = row.icon;
  const { cta } = row;

  return (
    <div
      className="tw:flex tw:items-start tw:gap-3 tw:px-4 tw:py-3"
      data-testid={`asset-health-row-${row.category}`}>
      <FeaturedIcon
        color={ASSET_HEALTH_TONE_COLOR[row.tone]}
        icon={RowIcon}
        radius="lg"
        shape="square"
        size="sm"
        theme="light"
      />
      <div className="tw:flex tw:min-w-0 tw:flex-col tw:max-w-[220px]">
        <span className="tw:truncate tw:text-xs tw:font-medium tw:text-primary">
          {row.title}
        </span>
        {row.subtitle && (
          <span className="tw:text-xs tw:text-secondary tw:break-words">
            {row.subtitle}
          </span>
        )}
      </div>
      {cta ? (
        <button
          className="tw:ml-auto tw:shrink-0 tw:cursor-pointer"
          data-testid={`asset-health-cta-${row.category}`}
          type="button"
          onClick={() => onCtaClick(cta.type)}>
          <BadgeWithIcon
            color="brand"
            iconTrailing={ChevronRight}
            size="sm"
            type="color">
            {t(cta.labelKey)}
          </BadgeWithIcon>
        </button>
      ) : (
        <Badge
          className="tw:ml-auto tw:shrink-0"
          color={ASSET_HEALTH_TONE_COLOR[row.tone]}
          size="sm"
          type="color">
          {row.badgeLabel}
        </Badge>
      )}
    </div>
  );
};

export default memo(AssetHealthRowItem);
