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
import { Button, Divider, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DownstreamIcon } from '../../../assets/svg/lineage-downstream-icon.svg';
import { ReactComponent as UpstreamIcon } from '../../../assets/svg/lineage-upstream-icon.svg';
import { LineagePagingInfo } from '../../../components/LineageTable/LineageTable.interface';
import { getLineagePagingData } from '../../../rest/lineageAPI';
import { getEntityCountAtDepth } from '../../../utils/EntityLineageUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import {
  LineageItemProps,
  LineageSectionProps,
} from './LineageSection.interface';

const LineageItem = React.memo<LineageItemProps>(function LineageItem({
  type,
  Icon,
  count,
  onClick,
}) {
  const { t } = useTranslation();

  return (
    <Button
      color="tertiary"
      data-testid={`${type}-lineage`}
      iconLeading={<Icon height={14} width={14} />}
      size="sm"
      onClick={onClick}>
      <div className="tw:flex tw:flex-row tw:gap-1">
        <Typography as="p" className="tw:text-blue-700 tw:font-normal">
          {t('label.-with-colon', { text: t(`label.${type}`) })}
        </Typography>
        <Typography
          as="p"
          className="tw:text-blue-700 tw:font-normal"
          data-testid={`${type}-count`}>
          {count}
        </Typography>
      </div>
    </Button>
  );
});

const LineageSection: React.FC<LineageSectionProps> = ({
  entityFqn,
  entityType,
  onLineageClick,
}) => {
  const { t } = useTranslation();
  const [lineagePagingInfo, setLineagePagingInfo] =
    useState<LineagePagingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchLineagePagingData = async () => {
      if (!entityFqn || !entityType) {
        setIsLoading(false);
        setLineagePagingInfo(null);

        return;
      }

      try {
        setIsLoading(true);
        const response = await getLineagePagingData({
          fqn: entityFqn,
          type: entityType,
        });

        setLineagePagingInfo(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
        setLineagePagingInfo(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLineagePagingData();
  }, [entityFqn, entityType]);

  const { upstreamCount, downstreamCount } = useMemo(() => {
    const upstream = getEntityCountAtDepth(
      lineagePagingInfo?.upstreamDepthInfo,
      1
    );
    const downstream = getEntityCountAtDepth(
      lineagePagingInfo?.downstreamDepthInfo,
      1
    );

    return { upstreamCount: upstream, downstreamCount: downstream };
  }, [lineagePagingInfo]);

  const hasLineage = upstreamCount > 0 || downstreamCount > 0;

  const handleClick = useCallback(() => {
    onLineageClick?.();
  }, [onLineageClick]);

  const renderContent = useMemo(() => {
    if (isLoading) {
      return <Loader size="small" />;
    }

    if (!hasLineage) {
      return (
        <Typography as="span" className="tw:text-gray-500 tw:text-xs">
          {t('message.no-lineage-available')}
        </Typography>
      );
    }

    return (
      <div className="tw:flex tw:flex-row tw:gap-3">
        <LineageItem
          Icon={UpstreamIcon}
          count={upstreamCount}
          type="upstream"
          onClick={handleClick}
        />
        <Divider className="tw:self-center tw:h-5" orientation="vertical" />
        <LineageItem
          Icon={DownstreamIcon}
          count={downstreamCount}
          type="downstream"
          onClick={handleClick}
        />
      </div>
    );
  }, [hasLineage, isLoading, downstreamCount, handleClick, t, upstreamCount]);

  return (
    <div
      className="tw:px-3.25 tw:pb-4 tw:border-b tw:border-gray-200"
      data-testid="lineage-section">
      <Typography as="p" className="tw:font-bold tw:text-gray-400">
        {t('label.lineage')}
      </Typography>
      {renderContent}
    </div>
  );
};

export default LineageSection;
