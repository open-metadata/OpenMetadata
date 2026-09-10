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
import { isEmpty } from 'lodash';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Table from '../../../components/common/Table/Table';
import { TableComponentProps } from '../../../components/common/Table/Table.interface';
import WidgetCard from '../../../components/common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../../components/Customization/GenericProvider/GenericContext';
import { DetailPageWidgetKeys } from '../../../enums/CustomizeDetailPage.enum';
import { Table as TableType } from '../../../generated/entity/data/table';
import Fqn from '../../../utils/Fqn';

interface AliasRow {
  key: string;
  name: string;
  fqn: string;
}

// Derived from the shared Table wrapper's own props rather than importing
// antd directly, which tw-guard rejects for new files.
type AliasColumns = NonNullable<TableComponentProps<AliasRow>['columns']>;

// Aliases are stored as fully qualified names, but the service, database and
// schema are already established by the page the widget sits on, so only the
// trailing name carries new information. Fqn.split is quote-aware: a name part
// may legitimately contain a dot, which a plain split would tear in half.
// Fqn.split retains quoting on each part and Fqn.unquoteName throws on a
// malformed name, so fall back to the raw value rather than letting one odd
// alias take down the whole table page.
const getAliasName = (fqn: string): string => {
  try {
    const parts = Fqn.split(fqn);

    return parts.length > 0 ? Fqn.unquoteName(parts[parts.length - 1]) : fqn;
  } catch {
    return fqn;
  }
};

export const TableAliases = ({
  renderAsExpandableCard = true,
}: {
  renderAsExpandableCard?: boolean;
}) => {
  const { data, filterWidgets } = useGenericContext<TableType>();
  const { t } = useTranslation();

  const aliasRows = useMemo<AliasRow[]>(
    () =>
      (data?.aliases ?? []).map((alias) => ({
        key: alias,
        name: getAliasName(alias),
        fqn: alias,
      })),
    [data?.aliases]
  );

  const columns = useMemo<AliasColumns>(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (name: string, record: AliasRow) => (
          <span title={record.fqn}>{name}</span>
        ),
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
