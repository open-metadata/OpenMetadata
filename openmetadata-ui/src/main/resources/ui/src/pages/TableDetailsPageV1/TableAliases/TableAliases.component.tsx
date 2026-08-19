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
import { ColumnsType } from 'antd/lib/table';
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../../components/common/Table/Table';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { Table as TableType } from '../../../generated/entity/data/table';

interface AliasRow {
  key: string;
  alias: string;
}

export const TableAliases = ({
  renderAsExpandableCard = true,
}: {
  renderAsExpandableCard?: boolean;
}) => {
  const { data, filterWidgets } = useGenericContext<TableType>();
  const { t } = useTranslation();

  const aliasRows = useMemo<AliasRow[]>(
    () => (data?.aliases ?? []).map((alias) => ({ key: alias, alias })),
    [data?.aliases]
  );

  const columns = useMemo<ColumnsType<AliasRow>>(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'alias',
        key: 'alias',
        ellipsis: true,
      },
    ],
    [t]
  );

  useEffect(() => {
    if (isEmpty(aliasRows)) {
      filterWidgets?.([DetailPageWidgetKeys.TABLE_ALIASES]);
    }
  }, [aliasRows]);

  if (isEmpty(aliasRows)) {
    return null;
  }

  const content = (
    <Table
      columns={columns}
      data-testid="table-aliases-table"
      dataSource={aliasRows}
      pagination={false}
      rowKey="key"
      size="small"
    />
  );

  return renderAsExpandableCard ? (
    <WidgetCard
      isExpandDisabled={isEmpty(aliasRows)}
      title={t('label.alias-plural')}>
      {content}
    </WidgetCard>
  ) : (
    content
  );
};
