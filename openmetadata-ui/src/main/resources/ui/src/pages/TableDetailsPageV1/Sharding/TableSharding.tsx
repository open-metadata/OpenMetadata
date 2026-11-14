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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { Table } from '../../../generated/entity/data/table';
import { formatDate } from '../../../utils/date-time/DateTimeUtils';
import {
  getBigQuerySourceLink,
  getTableSharding,
} from '../../../utils/TableShardingUtils';

export const TableShardingWidget = () => {
  const { data, filterWidgets } = useGenericContext<Table>();
  const { t } = useTranslation();
  const sharding = getTableSharding(data);
  useEffect(() => {
    if (!sharding) {
      filterWidgets?.([DetailPageWidgetKeys.TABLE_SHARDING]);
    }
  }, [sharding, filterWidgets]);
  if (!sharding) {
    return null;
  }

  return (
    <WidgetCard
      dataTestId="table-sharding"
      helperText={t('message.sharding-representative-columns')}
      title={t('label.sharding')}>
      <Box direction="col" gap={3}>
        <Box direction="col" gap={1}>
          <Typography color="secondary" size="text-xs">
            {t('label.representative')}
          </Typography>
          <Typography
            as="a"
            className="tw:break-all"
            color="brand"
            href={getBigQuerySourceLink(sharding)}
            rel="noopener noreferrer"
            size="text-sm"
            target="_blank">
            {sharding.representative.tableName}
          </Typography>
        </Box>
        <Box direction="col" gap={1}>
          <Typography color="secondary" size="text-xs">
            {t('label.shard-count')}
          </Typography>
          <Typography size="text-sm">{sharding.shardCount}</Typography>
        </Box>
        <Box direction="col" gap={1}>
          <Typography color="secondary" size="text-xs">
            {t('label.date-range')}
          </Typography>
          <Typography size="text-sm">
            {formatDate(new Date(sharding.firstShardDate).getTime(), true)} –{' '}
            {formatDate(new Date(sharding.lastShardDate).getTime(), true)}
          </Typography>
        </Box>
      </Box>
    </WidgetCard>
  );
};
