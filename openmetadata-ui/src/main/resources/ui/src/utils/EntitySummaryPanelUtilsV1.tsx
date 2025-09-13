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
import { Button, Col, Row, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FieldCard } from '../components/common/FieldCard';
import Loader from '../components/common/Loader/Loader';
import { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { PAGE_SIZE_LARGE } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { Column, Table } from '../generated/entity/data/table';
import { Paging } from '../generated/type/paging';
import { getDataModelColumnsByFQN } from '../rest/dataModelsAPI';
import { getTableColumnsByFQN } from '../rest/tableAPI';
import { t } from './i18next/LocalUtil';

const { Text } = Typography;

export const getEntityChildDetailsV1 = (
  entityType: EntityType,
  entityInfo: SearchedDataProps['data'][number]['_source'],
  highlights?: SearchedDataProps['data'][number]['highlight'],
  loading?: boolean
) => {
  let heading;
  let headingTestId = 'schema-header';
  switch (entityType) {
    case EntityType.TABLE:
      heading = t('label.schema');

      return (
        <SchemaFieldCardsV1
          entityInfo={entityInfo as Table}
          entityType={entityType}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.DASHBOARD_DATA_MODEL:
      heading = t('label.column-plural');
      headingTestId = 'column-header';

      return (
        <SchemaFieldCardsV1
          entityInfo={entityInfo as any}
          entityType={entityType}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.TOPIC:
      heading = t('label.schema');

      return (
        <TopicFieldCardsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.CONTAINER:
      heading = t('label.schema');

      return (
        <ContainerFieldCardsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.SEARCH_INDEX:
      heading = t('label.field-plural');
      headingTestId = 'fields-header';

      return (
        <SearchIndexFieldCardsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    default:
      return null;
  }
};

// Component for Table and Dashboard Data Model schema fields
const SchemaFieldCardsV1: React.FC<{
  entityInfo: Table | any;
  entityType: EntityType;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, entityType, highlights, loading }) => {
  const [columnsPaging, setColumnsPaging] = useState<Paging>({
    offset: 0,
    total: 0,
    limit: PAGE_SIZE_LARGE,
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [columns, setColumns] = useState<Column[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);
  const fqn = entityInfo.fullyQualifiedName ?? '';

  const fetchPaginatedColumns = useCallback(
    async (page = 1) => {
      setIsLoading(true);
      try {
        const api =
          entityType === EntityType.TABLE
            ? getTableColumnsByFQN
            : getDataModelColumnsByFQN;
        const offset = (page - 1) * (columnsPaging.limit ?? PAGE_SIZE_LARGE);
        const { data, paging } = await api(fqn, {
          offset,
          limit: columnsPaging.limit,
          fields: 'tags,customMetrics,glossaryTerms,description',
        });

        // For the first page, replace the columns. For subsequent pages, append.
        if (page === 1) {
          setColumns(data);
        } else {
          setColumns((prev) => [...prev, ...data]);
        }
        setColumnsPaging(paging);
        setHasInitialized(true);
      } catch (error) {
        setColumns([]);
        setColumnsPaging({
          offset: 0,
          total: 0,
          limit: PAGE_SIZE_LARGE,
        });
        setHasInitialized(true);
        // eslint-disable-next-line no-console
        console.error('Error fetching columns:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [fqn, entityType, columnsPaging.limit]
  );

  const handleLoadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetchPaginatedColumns(nextPage);
  }, [currentPage, fetchPaginatedColumns]);

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
      setIsLoading(false);
      setHasInitialized(false);
    };
  }, [entityType, fqn]);

  const loadMoreBtn = useMemo(() => {
    if (columns.length === columnsPaging.total) {
      return null;
    }

    return (
      <Button
        block
        loading={isLoading && currentPage > 1}
        type="link"
        onClick={handleLoadMore}
      >
        {t('label.show-more')}
      </Button>
    );
  }, [
    columns.length,
    columnsPaging.total,
    isLoading,
    currentPage,
    handleLoadMore,
  ]);

  if (loading || (isLoading && !hasInitialized)) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(columns) && hasInitialized) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  // If not initialized yet, show loading
  if (!hasInitialized) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {columns.map((column) => {
          const isHighlighted = highlights?.column?.includes(column.name);

          return (
            <Col key={column.name} span={24}>
              <FieldCard
                dataType={column.dataType || 'Unknown'}
                description={column.description}
                fieldName={column.name}
                isHighlighted={isHighlighted}
                tableConstraints={entityInfo.tableConstraints}
                tags={column.tags}
              />
            </Col>
          );
        })}
      </Row>
      {loadMoreBtn}
    </div>
  );
};

// Component for Topic schema fields
const TopicFieldCardsV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const schemaFields = entityInfo.messageSchema?.schemaFields || [];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(schemaFields)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {schemaFields.map((field: any) => {
          const isHighlighted = highlights?.field?.includes(field.name);

          return (
            <Col key={field.name} span={24}>
              <FieldCard
                dataType={field.dataType || 'Unknown'}
                description={field.description}
                fieldName={field.name}
                glossaryTerms={field.glossaryTerms}
                isHighlighted={isHighlighted}
                tags={field.tags}
              />
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

// Component for Container schema fields
const ContainerFieldCardsV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const columns = entityInfo.dataModel?.columns || [];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(columns)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {columns.map((column: any) => {
          const isHighlighted = highlights?.column?.includes(column.name);

          return (
            <Col key={column.name} span={24}>
              <FieldCard
                dataType={column.dataType || 'Unknown'}
                description={column.description}
                fieldName={column.name}
                glossaryTerms={column.glossaryTerms}
                isHighlighted={isHighlighted}
                tags={column.tags}
              />
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

// Component for Search Index fields
const SearchIndexFieldCardsV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const fields = entityInfo.fields || [];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(fields)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {fields.map((field: any) => {
          const isHighlighted = highlights?.field?.includes(field.name);

          return (
            <Col key={field.name} span={24}>
              <FieldCard
                dataType={field.dataType || 'Unknown'}
                description={field.description}
                fieldName={field.name}
                glossaryTerms={field.glossaryTerms}
                isHighlighted={isHighlighted}
                tags={field.tags}
              />
            </Col>
          );
        })}
      </Row>
    </div>
  );
};
