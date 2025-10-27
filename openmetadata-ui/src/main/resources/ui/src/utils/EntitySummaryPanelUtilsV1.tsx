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
import { Button, Col, Row, Segmented, Table, Typography } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FieldCard } from '../components/common/FieldCard';
import Loader from '../components/common/Loader/Loader';
import { SearchedDataProps } from '../components/SearchedData/SearchedData.interface';
import { PAGE_SIZE_LARGE } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { Column, Table as TableEntity } from '../generated/entity/data/table';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import { getDataModelColumnsByFQN } from '../rest/dataModelsAPI';
import { getTableColumnsByFQN, getTableList } from '../rest/tableAPI';
import { t } from './i18next/LocalUtil';

const { Text } = Typography;

export const getEntityChildDetailsV1 = (
  entityType: EntityType,
  entityInfo: SearchedDataProps['data'][number]['_source'],
  highlights?: SearchedDataProps['data'][number]['highlight'],
  loading?: boolean
) => {
  // kept for potential future use; remove unused to satisfy linter
  switch (entityType) {
    case EntityType.TABLE:
      return (
        <SchemaFieldCardsV1
          entityInfo={entityInfo as TableEntity}
          entityType={entityType}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.DATABASE_SCHEMA:
      return (
        <DatabaseSchemaTablesV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.DASHBOARD:
      return (
        <DashboardChartsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.DASHBOARD_DATA_MODEL:
      return (
        <SchemaFieldCardsV1
          entityInfo={entityInfo as any}
          entityType={entityType}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.TOPIC:
      return (
        <TopicFieldCardsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.CONTAINER:
      return (
        <ContainerFieldCardsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.SEARCH_INDEX:
      return (
        <SearchIndexFieldCardsV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.API_ENDPOINT:
      return (
        <APIEndpointSchemaV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.DATABASE:
      return (
        <DatabaseSchemasV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.PIPELINE:
      return (
        <PipelineTasksV1
          entityInfo={entityInfo as any}
          highlights={highlights}
          loading={loading}
        />
      );

    case EntityType.API_COLLECTION:
      return (
        <APICollectionEndpointsV1
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
  entityInfo: TableEntity | any;
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
        onClick={handleLoadMore}>
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

// Component for Pipeline tasks
const PipelineTasksV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const tasks = entityInfo.tasks || [];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(tasks)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {tasks.map((task: any) => {
          const isHighlighted = highlights?.tasks?.includes(task.name);

          return (
            <Col key={task.name} span={24}>
              <FieldCard
                dataType={task.taskType || t('label.task')}
                description={task.description}
                fieldName={task.displayName || task.name}
                glossaryTerms={task.glossaryTerms}
                isHighlighted={isHighlighted}
                tags={task.tags}
              />
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

// Component for API Collection endpoints
const APICollectionEndpointsV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const [endpoints, setEndpoints] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);
  const fqn = entityInfo.fullyQualifiedName ?? '';

  const fetchEndpoints = useCallback(async () => {
    if (!fqn) {
      setHasInitialized(true);

      return;
    }

    setIsLoading(true);
    try {
      // Extract service from FQN
      // FQN format: ServiceName.ApiCollectionName
      const fqnParts = fqn.split('.');

      if (fqnParts.length >= 2) {
        const serviceName = fqnParts[0];
        // Use the full FQN for apiCollection parameter
        const collectionFQN = fqn;

        // Import dynamically to avoid circular dependencies
        const { getApiEndPoints } = await import('../rest/apiEndpointsAPI');
        const { Include } = await import('../generated/type/include');

        const response = await getApiEndPoints({
          service: serviceName,
          apiCollection: collectionFQN,
          paging: { limit: PAGE_SIZE_LARGE },
          include: Include.NonDeleted,
        });

        setEndpoints(response.data || []);
      }
      setHasInitialized(true);
    } catch (error) {
      setEndpoints([]);
      setHasInitialized(true);
      // eslint-disable-next-line no-console
      console.error('Error fetching API endpoints:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchEndpoints();

    return () => {
      setEndpoints([]);
      setIsLoading(false);
      setHasInitialized(false);
    };
  }, [fetchEndpoints]);

  if (loading || (isLoading && !hasInitialized)) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(endpoints) && hasInitialized) {
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
        {endpoints.map((endpoint: any) => {
          const isHighlighted = highlights?.apiEndpoints?.includes(
            endpoint.name
          );

          return (
            <Col key={endpoint.id || endpoint.name} span={24}>
              <FieldCard
                dataType={endpoint.requestMethod || t('label.api-endpoint')}
                description={endpoint.description}
                fieldName={endpoint.displayName || endpoint.name}
                isHighlighted={isHighlighted}
                tags={endpoint.tags}
              />
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

// Component for Database Schema tables
const DatabaseSchemaTablesV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const [tables, setTables] = useState<TableEntity[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasInitialized, setHasInitialized] = useState<boolean>(false);
  const fqn = entityInfo.fullyQualifiedName ?? '';

  const fetchPaginatedTables = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data } = await getTableList({
        databaseSchema: fqn,
        limit: PAGE_SIZE_LARGE,
        fields: 'tags,owners,domains,dataProducts',
        include: Include.NonDeleted,
      });

      setTables(data);
      setHasInitialized(true);
    } catch (error) {
      setTables([]);
      setHasInitialized(true);
      // eslint-disable-next-line no-console
      console.error('Error fetching tables:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  useEffect(() => {
    fetchPaginatedTables();

    return () => {
      setTables([]);
      setIsLoading(false);
      setHasInitialized(false);
    };
  }, [fetchPaginatedTables]);

  const loadMoreBtn = useMemo(() => {
    // For now, we fetch all tables at once, so no load more button needed
    // This can be enhanced later with proper cursor-based pagination
    return null;
  }, []);

  if (loading || (isLoading && !hasInitialized)) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(tables) && hasInitialized) {
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
        {tables.map((table) => {
          const isHighlighted = highlights?.table?.includes(table.name);

          return (
            <Col key={table.name} span={24}>
              <FieldCard
                dataType={table.tableType || 'Table'}
                description={table.description}
                fieldName={table.name}
                isHighlighted={isHighlighted}
                tags={table.tags}
              />
            </Col>
          );
        })}
      </Row>
      {loadMoreBtn}
    </div>
  );
};

// Component for Dashboard charts
const DashboardChartsV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const charts = entityInfo.charts || [];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(charts)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {charts.map((chart: any) => {
          const isHighlighted = highlights?.chart?.includes(chart.name);

          return (
            <Col key={chart.id} span={24}>
              <FieldCard
                dataType="Chart"
                description={chart.description}
                fieldName={chart.displayName || chart.name}
                isHighlighted={isHighlighted}
                tags={chart.tags}
              />
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

// Component for API Endpoint schema fields
const APIEndpointSchemaV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const [viewType, setViewType] = useState<
    'request-schema' | 'response-schema'
  >('request-schema');
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);

  const requestSchemaFields = entityInfo.requestSchema?.schemaFields || [];
  const responseSchemaFields = entityInfo.responseSchema?.schemaFields || [];

  const viewTypeOptions = [
    {
      label: t('label.request'),
      value: 'request-schema',
    },
    {
      label: t('label.response'),
      value: 'response-schema',
    },
  ];

  const activeSchemaFields = useMemo(() => {
    return viewType === 'request-schema'
      ? requestSchemaFields
      : responseSchemaFields;
  }, [viewType, requestSchemaFields, responseSchemaFields]);

  // Get all row keys for expandable functionality
  const getAllRowKeys = (fields: any[]): string[] => {
    const keys: string[] = [];
    const traverse = (fieldList: any[]) => {
      fieldList.forEach((field) => {
        keys.push(field.name);
        if (field.children && field.children.length > 0) {
          traverse(field.children);
        }
      });
    };
    traverse(fields);

    return keys;
  };

  const allRowKeys = useMemo(
    () => getAllRowKeys(activeSchemaFields),
    [activeSchemaFields]
  );

  const handleExpandedRowsChange = (keys: readonly React.Key[]) => {
    setExpandedRowKeys(keys as string[]);
  };

  const handleToggleExpandAll = () => {
    if (expandedRowKeys.length < allRowKeys.length) {
      setExpandedRowKeys(allRowKeys);
    } else {
      setExpandedRowKeys([]);
    }
  };

  const columns = [
    {
      title: t('label.name'),
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name: string, record: any) => (
        <div className="d-inline-flex w-max-90">
          <span className="break-word">{record.displayName || name}</span>
        </div>
      ),
    },
    {
      title: t('label.type'),
      dataIndex: 'dataType',
      key: 'dataType',
      width: 150,
      render: (dataType: string, record: any) => (
        <Typography.Text>
          {record.dataTypeDisplay || dataType || 'Unknown'}
        </Typography.Text>
      ),
    },
    {
      title: t('label.description'),
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        <div className="break-word">
          {description || (
            <span className="text-grey-muted">{t('label.no-description')}</span>
          )}
        </div>
      ),
    },
    {
      title: t('label.tag-plural'),
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags: any[]) => (
        <div className="d-flex flex-wrap gap-2">
          {tags?.map((tag, index) => (
            <span className="tag-container" key={index}>
              {tag.displayName || tag.name}
            </span>
          )) || <span className="text-grey-muted">{t('label.no-tags')}</span>}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(requestSchemaFields) && isEmpty(responseSchemaFields)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      {/* Schema Type Toggle */}
      <div className="mb-md p-x-md d-flex p-y-md justify-between items-center">
        <Segmented
          className="segment-toggle"
          options={viewTypeOptions}
          value={viewType}
          onChange={(value) =>
            setViewType(value as 'request-schema' | 'response-schema')
          }
        />
        <Button size="small" type="link" onClick={handleToggleExpandAll}>
          {expandedRowKeys.length < allRowKeys.length
            ? t('label.expand-all')
            : t('label.collapse-all')}
        </Button>
      </div>

      {/* Schema Fields Table */}
      {!isEmpty(activeSchemaFields) ? (
        <div className="m-l-md">
          <Table
            columns={columns}
            dataSource={activeSchemaFields}
            expandable={{
              rowExpandable: (record) => !isEmpty(record.children),
              onExpandedRowsChange: handleExpandedRowsChange,
              expandedRowKeys,
              childrenColumnName: 'children',
            }}
            pagination={false}
            rowKey="name"
            scroll={{ x: 800 }}
            size="small"
          />
        </div>
      ) : (
        <div className="no-data-container m-x-md">
          <Text className="no-data-text">{t('message.no-data-available')}</Text>
        </div>
      )}
    </div>
  );
};

// Component for Database schemas
const DatabaseSchemasV1: React.FC<{
  entityInfo: any;
  highlights?: Record<string, string[]>;
  loading?: boolean;
}> = ({ entityInfo, highlights, loading }) => {
  const databaseSchemas = entityInfo.databaseSchemas || [];

  if (loading) {
    return (
      <div className="flex-center p-lg">
        <Loader size="default" />
      </div>
    );
  }

  if (isEmpty(databaseSchemas)) {
    return (
      <div className="no-data-container">
        <Text className="no-data-text">{t('message.no-data-available')}</Text>
      </div>
    );
  }

  return (
    <div className="schema-field-cards-container">
      <Row>
        {databaseSchemas.map((schema: any) => {
          return (
            <Col key={schema.id} span={24}>
              <FieldCard
                dataType={schema.type || 'Database Schema'}
                description={schema.description || ''}
                fieldName={schema.displayName || schema.name}
                tags={schema.tags || []}
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
