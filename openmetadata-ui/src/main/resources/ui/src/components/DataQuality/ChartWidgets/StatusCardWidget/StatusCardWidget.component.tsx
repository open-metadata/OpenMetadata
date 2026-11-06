/*
 *  Copyright 2024 Collate.
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
  Box,
  Card,
  Skeleton,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DataQualityDimensions } from '../../../../enums/DataQuality.enum';
import { getDimensionIconClassName } from '../../../../utils/DataQuality/DataQualityPureUtils';
import '../chart-widgets.less';
import './status-card-widget.less';
import { StatusCardWidgetProps } from './StatusCardWidget.interface';

const StatusDataWidget = ({
  statusData,
  icon,
  redirectPath,
  isLoading,
}: StatusCardWidgetProps) => {
  const IconSvg = icon;
  const { t } = useTranslation();

  const countCard = useMemo(
    () => ({
      success: statusData.success,
      failed: statusData.failed,
      aborted: statusData.aborted,
    }),
    [statusData]
  );

  const body = (
    <Box
      className="w-full"
      data-testid="status-data-widget"
      direction="col"
      gap={4}>
      <div className="d-flex items-center gap-2">
        <IconSvg
          className={getDimensionIconClassName(
            statusData.title as DataQualityDimensions
          )}
          size={20}
        />
        <Typography
          as="span"
          className="font-semibold text-sm"
          data-testid="status-title">
          {statusData.title === DataQualityDimensions.NoDimension
            ? t('label.no-dimension')
            : statusData.title}
        </Typography>
      </div>
      <div className="d-flex flex-wrap justify-between gap-2">
        <Typography
          as="span"
          className="chart-widget-link-underline"
          data-testid="total-value"
          size="text-xl"
          weight="semibold">
          {statusData.total}
        </Typography>
        <div className="d-flex items-center gap-3">
          {Object.entries(countCard).map(([key, value]) => (
            <Tooltip key={key} title={t(`label.${key}`)}>
              <div
                className={`status-count-container ${key}`}
                data-testid={`${key}-count`}>
                {value}
              </div>
            </Tooltip>
          ))}
        </div>
      </div>
    </Box>
  );

  if (isLoading) {
    return (
      <Card
        className={classNames('status-card-widget-container', {
          'chart-widget-link-no-underline': !isUndefined(redirectPath),
        })}>
        <Skeleton height={120} width="100%" />
      </Card>
    );
  }

  return (
    <Card
      className={classNames('status-card-widget-container', {
        'chart-widget-link-no-underline': !isUndefined(redirectPath),
      })}>
      {redirectPath ? <Link to={redirectPath}>{body}</Link> : body}
    </Card>
  );
};

export default StatusDataWidget;
