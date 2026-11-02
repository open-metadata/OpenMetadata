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
import { Box, Card } from '@openmetadata/ui-core-components';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { Table } from '../../../generated/entity/data/table';
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
    <Card data-testid="table-sharding">
      <Card.Header title={t('label.sharding')} />
      <Card.Content>
        <Box direction="col" gap={2}>
          <span>
            {t('label.representative')}:{' '}
            <a
              href={getBigQuerySourceLink(sharding)}
              rel="noopener noreferrer"
              target="_blank">
              {sharding.representative.tableName}
            </a>
          </span>
          <span>
            {t('label.shard-count')}: {sharding.shardCount}
          </span>
          <span>
            {sharding.firstShardDate} – {sharding.lastShardDate}
          </span>
          <span>{t('message.sharding-representative-columns')}</span>
        </Box>
      </Card.Content>
    </Card>
  );
};
