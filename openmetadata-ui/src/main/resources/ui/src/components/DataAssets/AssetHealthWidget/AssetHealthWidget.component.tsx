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
import { Badge, Skeleton } from '@openmetadata/ui-core-components';
import { Shield01 } from '@untitledui/icons';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import {
  ServiceAgentSubTabs,
  ServiceCategory,
} from '../../../enums/service.enum';
import { Table } from '../../../generated/entity/data/table';
import {
  getEntityDetailsPath,
  getServiceDetailsPath,
} from '../../../utils/RouterUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import AssetHealthRowItem from './AssetHealthRowItem.component';
import { ASSET_HEALTH_TONE_COLOR } from './AssetHealthWidget.constant';
import { AssetHealthCTAType } from './AssetHealthWidget.interface';
import { getAssetHealthHeader } from './AssetHealthWidget.utils';
import { useAssetHealth } from './useAssetHealth';

const AssetHealthWidget = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: table } = useGenericContext<Table>();
  const { rows, isLoading, isError } = useAssetHealth(table);

  const serviceFqn = table?.service?.fullyQualifiedName;
  const tableFqn = table?.fullyQualifiedName;

  const header = useMemo(() => getAssetHealthHeader(rows), [rows]);

  const handleCTAClick = useCallback(
    (ctaType: AssetHealthCTAType) => {
      if (ctaType === AssetHealthCTAType.LinkPipeline) {
        if (serviceFqn) {
          navigate(
            getServiceDetailsPath(
              serviceFqn,
              ServiceCategory.DATABASE_SERVICES,
              EntityTabs.AGENTS,
              ServiceAgentSubTabs.METADATA
            )
          );
        }

        return;
      }

      if (!tableFqn) {
        return;
      }

      const tab =
        ctaType === AssetHealthCTAType.CreateContract
          ? EntityTabs.CONTRACT
          : EntityTabs.PROFILER;
      navigate(getEntityDetailsPath(EntityType.TABLE, tableFqn, tab));
    },
    [navigate, serviceFqn, tableFqn]
  );

  const titleGroup = (
    <div className="tw:flex tw:items-center tw:gap-2">
      <div className="tw:flex tw:size-8 tw:items-center tw:justify-center tw:rounded-lg tw:bg-utility-blue-light-50">
        <Shield01 className="tw:size-5 tw:text-utility-blue-light-600" />
      </div>
      <span className="tw:text-sm tw:font-medium tw:text-primary">
        {t('label.asset-health')}
      </span>
    </div>
  );

  if (isLoading) {
    return (
      <div
        className="tw:flex tw:flex-col tw:gap-3 tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:p-4"
        data-testid="asset-health-widget-loading">
        <Skeleton height={20} variant="rounded" width={120} />
        <Skeleton height={48} variant="rounded" />
        <Skeleton height={48} variant="rounded" />
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="tw:flex tw:flex-col tw:gap-3 tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary tw:p-4"
        data-testid="asset-health-widget-error">
        {titleGroup}
        <span className="tw:text-xs tw:text-secondary">
          {t('server.entity-fetch-error', { entity: t('label.asset-health') })}
        </span>
      </div>
    );
  }

  return (
    <div
      className="tw:flex tw:flex-col tw:rounded-[10px] tw:border tw:border-secondary tw:bg-primary"
      data-testid="asset-health-widget">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2 tw:px-4 tw:pb-3 tw:pt-4">
        {titleGroup}
        <Badge
          color={ASSET_HEALTH_TONE_COLOR[header.tone]}
          size="sm"
          type="color">
          {t(header.labelKey)}
        </Badge>
      </div>
      <div className="tw:border-b tw:border-secondary" />
      <div className="tw:flex tw:flex-col">
        {rows.map((row) => (
          <AssetHealthRowItem
            key={row.category}
            row={row}
            onCtaClick={handleCTAClick}
          />
        ))}
      </div>
    </div>
  );
};

export default AssetHealthWidget;
