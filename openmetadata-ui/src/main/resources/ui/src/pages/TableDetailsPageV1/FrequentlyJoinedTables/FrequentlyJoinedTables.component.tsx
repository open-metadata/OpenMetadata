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
import { Space, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ExpandableCard from '../../../components/common/ExpandableCard/ExpandableCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericProvider';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import { JoinedWith, Table } from '../../../generated/entity/data/table';
import { getCountBadge } from '../../../utils/CommonUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { getJoinsFromTableJoins } from '../../../utils/TableUtils';
import './frequently-joined-tables.style.less';

export type Joined = JoinedWith & {
  name: string;
};

export const FrequentlyJoinedTables = () => {
  const { t } = useTranslation();
  const { data, filterWidgets } = useGenericContext<Table>();

  const joinedTables = useMemo(
    () => getJoinsFromTableJoins(data?.joins),
    [data?.joins]
  );

  useEffect(() => {
    if (isEmpty(joinedTables)) {
      filterWidgets?.([DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]);
    }
  }, [joinedTables]);

  if (isEmpty(joinedTables)) {
    return null;
  }

  const content = joinedTables.map((table) => (
    <Space
      className="w-full frequently-joint-data justify-between m-t-xss"
      data-testid="related-tables-data"
      key={table.name}
      size={4}>
      <Link
        to={getEntityDetailsPath(EntityType.TABLE, table.fullyQualifiedName)}>
        <Typography.Text className="frequently-joint-name">
          {table.name}
        </Typography.Text>
      </Link>
      {getCountBadge(table.joinCount, '', false)}
    </Space>
  ));

  return (
    <ExpandableCard
      cardProps={{
        title: t('label.frequently-joined-table-plural'),
      }}
      dataTestId="frequently-joint-data-container"
      isExpandDisabled={isEmpty(joinedTables)}>
      {content}
    </ExpandableCard>
  );
};
