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
import { Button, Skeleton } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_LARGE } from '../../../../constants/constants';
import { EntityType } from '../../../../enums/entity.enum';
import { SummaryEntityType } from '../../../../enums/EntitySummary.enum';
import { Column, Table } from '../../../../generated/entity/data/table';
import { Paging } from '../../../../generated/type/paging';
import { getDataModelColumnsByFQN } from '../../../../rest/dataModelsAPI';
import { getTableColumnsByFQN } from '../../../../rest/tableAPI';
import { getFormattedEntityData } from '../../../../utils/EntitySummaryPanelUtils';
import SummaryList from '../SummaryList/SummaryList.component';
import { ColumnSummaryListProps } from './ColumnsSummaryList.interface';

export const ColumnSummaryList = ({
  entityType,
  entityInfo,
  highlights,
}: ColumnSummaryListProps) => {
  const [columnsPaging, setColumnsPaging] = useState<Paging>({
    offset: 0,
    total: 0,
    limit: PAGE_SIZE_LARGE,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const fqn = entityInfo.fullyQualifiedName ?? '';
  const { t } = useTranslation();

  const fetchPaginatedColumns = useCallback(
    async (page = 1) => {
      setLoading(true);
      try {
        const api =
          entityType === EntityType.TABLE
            ? getTableColumnsByFQN
            : getDataModelColumnsByFQN;
        const offset = (page - 1) * (columnsPaging.limit ?? PAGE_SIZE_LARGE);
        const { data, paging } = await api(fqn, {
          offset,
          limit: columnsPaging.limit,
        });

        setColumns((prev) => [...prev, ...data]);
        setColumnsPaging(paging);
      } catch (error) {
        setColumns([]);
        setColumnsPaging({
          offset: 0,
          total: 0,
          limit: PAGE_SIZE_LARGE,
        });
        // eslint-disable-next-line no-console
        console.error(error);
      } finally {
        setLoading(false);
      }
    },
    [fqn, entityType, currentPage]
  );

  const handleLoadMore = useCallback(() => {
    setCurrentPage(currentPage + 1);
    fetchPaginatedColumns(currentPage + 1);
  }, [currentPage]);

  useEffect(() => {
    if (
      [EntityType.TABLE, EntityType.DASHBOARD_DATA_MODEL].includes(entityType)
    ) {
      fetchPaginatedColumns();
    }

    return () => {
      setColumns([]);
      setColumnsPaging({
        offset: 0,
        total: 0,
        limit: PAGE_SIZE_LARGE,
      });
    };
  }, [entityType, fqn]);

  const loadMoreBtn = useMemo(() => {
    if (columns.length === columnsPaging.total) {
      return null;
    }

    return (
      <Button
        block
        loading={loading && currentPage > 1}
        type="link"
        onClick={handleLoadMore}>
        {t('label.show-more')}
      </Button>
    );
  }, [loading, currentPage, handleLoadMore, t]);

  if (loading && currentPage === 1) {
    return <Skeleton active paragraph={{ rows: 1 }} />;
  }

  return (
    <>
      <SummaryList
        entityType={SummaryEntityType.COLUMN}
        formattedEntityData={getFormattedEntityData(
          SummaryEntityType.COLUMN,
          columns,
          highlights,
          (entityInfo as Table).tableConstraints
        )}
      />

      {loadMoreBtn}
    </>
  );
};
