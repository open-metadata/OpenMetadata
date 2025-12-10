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
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import { ColumnsType } from 'antd/es/table';
import Card from 'antd/lib/card/Card';
import classNames from 'classnames';
import { isEmpty, map, sortBy } from 'lodash';
import QueryString from 'qs';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../assets/svg/drop-down.svg';
import { ReactComponent as TrendDownIcon } from '../../assets/svg/ic-trend-down.svg';
import { LINEAGE_DROPDOWN_ITEMS } from '../../constants/AdvancedSearch.constants';
import {
  FULLSCREEN_QUERY_PARAM_KEY,
  NO_DATA,
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';
import {
  IMPACT_ANALYSIS_DEFAULT_VISIBLE_COLUMNS,
  IMPACT_ANALYSIS_STATIC_COLUMNS,
} from '../../constants/Lineage.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SIZE } from '../../enums/common.enum';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { EntityReference } from '../../generated/tests/testCase';
import { Paging } from '../../generated/type/paging';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { SearchSourceAlias } from '../../interface/search.interface';
import { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import {
  getLineageByEntityCount,
  getLineageDataByFQN,
  getLineagePagingData,
} from '../../rest/lineageAPI';
import {
  getPartialNameFromTableFQN,
  Transi18next,
} from '../../utils/CommonUtils';
import {
  getEntityLinkFromType,
  getEntityName,
  highlightSearchText,
} from '../../utils/EntityUtils';
import { getQuickFilterQuery } from '../../utils/ExploreUtils';
import {
  getSearchNameEsQuery,
  LINEAGE_IMPACT_OPTIONS,
  prepareDownstreamColumnLevelNodesFromDownstreamEdges,
  prepareUpstreamColumnLevelNodesFromUpstreamEdges,
} from '../../utils/Lineage/LineageUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { DomainLabel } from '../common/DomainLabel/DomainLabel.component';
import NoDataPlaceholder from '../common/ErrorWithPlaceholder/NoDataPlaceholder';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import Table from '../common/Table/Table';
import TierTag from '../common/TierTag';
import TableTags from '../Database/TableTags/TableTags.component';
import CustomControlsComponent from '../Entity/EntityLineage/CustomControls.component';
import { LineageNode } from '../Lineage/Lineage.interface';
import {
  SearchedDataProps,
  SourceType,
} from '../SearchedData/SearchedData.interface';
import { EImpactLevel } from './LineageTable.interface';
import { StyledMenu, StyledToggleButtonGroup } from './LineageTable.styled';
import { useLineageTableState } from './useLineageTableState';

const LineageTable: FC<{ entity: SourceType }> = ({ entity }) => {
  const {
    selectedQuickFilters,
    setSelectedQuickFilters,
    lineageConfig,
    updateEntityData,
  } = useLineageProvider();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Use the custom hook for state management
  const {
    filterNodes,
    loading,
    searchValue,
    impactLevel,
    upstreamColumnLineageNodes,
    downstreamColumnLineageNodes,
    lineagePagingInfo,
    setFilterNodes,
    setLoading,
    setSearchValue,
    setImpactLevel: setSelectedImpactLevel,
    setColumnLineageNodes,
    setLineagePagingInfo,
  } = useLineageTableState();
  const {
    currentPage,
    pageSize,
    paging,
    showPagination,
    handlePageChange,
    handlePagingChange,
    handlePageSizeChange,
  } = usePaging(PAGE_SIZE_LARGE);

  const [impactOnEl, setImpactOnEl] = useState<null | HTMLElement>(null);

  const { isFullScreen, nodeDepth, lineageDirection } = useMemo(() => {
    const queryParams = QueryString.parse(location.search, {
      ignoreQueryPrefix: true,
    });

    const lineageDirection =
      (queryParams['dir'] as LineageDirection) || LineageDirection.Downstream;

    const directionalDepth =
      lineageDirection === LineageDirection.Downstream
        ? lineageConfig.downstreamDepth
        : lineageConfig.upstreamDepth;

    const nodeDepth = Number.isNaN(Number(queryParams['depth']))
      ? directionalDepth
      : Number(queryParams['depth']);

    return {
      isFullScreen: queryParams[FULLSCREEN_QUERY_PARAM_KEY] === 'true',
      nodeDepth,
      lineageDirection,
    };
  }, [
    location.search,
    lineageConfig.downstreamDepth,
    lineageConfig.upstreamDepth,
  ]);

  const updateURLParams = useCallback(
    (
      data: Partial<{
        dir: LineageDirection;
        depth: number;
        [FULLSCREEN_QUERY_PARAM_KEY]: boolean;
      }>
    ) => {
      const params = QueryString.parse(location.search, {
        ignoreQueryPrefix: true,
      });
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          params[key] = String(value);
        }
      }

      navigate(
        {
          search: QueryString.stringify(params, {
            encode: false,
            addQueryPrefix: true,
          }),
        },
        { replace: true }
      );
    },
    [location.search]
  );

  // Get upstream and downstream count when fqn, entityType, lineageDirection or nodeDepth changes
  const { upstreamCount, downstreamCount } = useMemo(() => {
    if (impactLevel === EImpactLevel.ColumnLevel) {
      handlePagingChange({
        total:
          lineageDirection === LineageDirection.Upstream
            ? upstreamColumnLineageNodes.length
            : downstreamColumnLineageNodes.length,
      } as Paging);

      return {
        upstreamCount: upstreamColumnLineageNodes.length,
        downstreamCount: downstreamColumnLineageNodes.length,
      };
    }

    const upstreamCount =
      lineagePagingInfo?.upstreamDepthInfo.reduce((acc, record) => {
        // No need to count depth 0 nodes as they are not shown in the table
        // Need count till nodeDepth - 1 as depth 0 nodes are not shown in the table
        if (record.depth > nodeDepth || record.depth === 0) {
          return acc;
        }
        acc += record.entityCount;

        return acc;
      }, 0) ?? 0;
    const downstreamCount =
      lineagePagingInfo?.downstreamDepthInfo.reduce((acc, record) => {
        // No need to count depth 0 nodes as they are not shown in the table
        // Need count till nodeDepth - 1 as depth 0 nodes are not shown in the table
        if (record.depth > nodeDepth || record.depth === 0) {
          return acc;
        }
        acc += record.entityCount;

        return acc;
      }, 0) ?? 0;

    handlePagingChange({
      total:
        lineageDirection === LineageDirection.Downstream
          ? downstreamCount
          : upstreamCount,
    } as Paging);

    return { upstreamCount, downstreamCount };
  }, [
    lineagePagingInfo,
    nodeDepth,
    impactLevel,
    upstreamColumnLineageNodes,
    downstreamColumnLineageNodes,
    lineageDirection,
  ]);

  const radioGroupOptions = useMemo(() => {
    return [
      {
        label: (
          <>
            {t('label.upstream')}{' '}
            <Chip label={upstreamCount} size="small" variant="outlined" />
          </>
        ),
        value: LineageDirection.Upstream,
      },
      {
        label: (
          <>
            {t('label.downstream')}{' '}
            <Chip label={downstreamCount} size="small" />
          </>
        ),
        value: LineageDirection.Downstream,
      },
    ];
  }, [upstreamCount, downstreamCount]);

  const streamButtonGroup = useMemo(() => {
    return (
      <StyledToggleButtonGroup
        exclusive
        size="small"
        value={lineageDirection}
        onChange={(_, value) => {
          handlePageChange(1);
          updateURLParams({ dir: value });
        }}>
        {radioGroupOptions.map((option) => (
          <ToggleButton
            className="font-semibold"
            key={option.value}
            value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </StyledToggleButtonGroup>
    );
  }, [lineageDirection, radioGroupOptions]);

  // Query filter for table data & search values
  const queryFilter = useMemo(() => {
    const quickFilterQuery = getQuickFilterQuery(selectedQuickFilters);
    const mustClauses: QueryFieldInterface[] = [];

    // Add quick filter conditions (e.g., service field conditions)
    if (quickFilterQuery?.query?.bool?.must) {
      mustClauses.push(...quickFilterQuery.query.bool.must);
    }

    // Add search value conditions for name and displayName using wildcard
    if (searchValue) {
      mustClauses.push(getSearchNameEsQuery(searchValue));
    }

    // Build final query only if we have conditions
    const query =
      mustClauses.length > 0
        ? { query: { bool: { must: mustClauses } } }
        : undefined;

    return JSON.stringify(query);
  }, [selectedQuickFilters, searchValue]);

  // Define table columns
  const extraTableFilters = useMemo(() => {
    return (
      <div className="d-flex justify-between items-center w-full">
        <div>{streamButtonGroup}</div>

        <Button
          aria-controls={impactOnEl ? 'basic-menu' : undefined}
          aria-expanded={impactOnEl ? 'true' : undefined}
          aria-haspopup="true"
          endIcon={<DropdownIcon />}
          id="impact-on-dropdown"
          startIcon={<TrendDownIcon />}
          sx={{
            fontWeight: 500,
            '& .MuiButton-endIcon': {
              svg: {
                height: 12,
              },
            },
          }}
          onClick={(event) => setImpactOnEl(event.currentTarget)}>
          <Transi18next
            i18nKey="label.impact-on-area"
            renderElement={<span className="m-l-xss text-primary" />}
            values={{ area: t(`label.${impactLevel}`) }}
          />
        </Button>
        <StyledMenu
          anchorEl={impactOnEl}
          open={Boolean(impactOnEl)}
          onClose={() => setImpactOnEl(null)}>
          {LINEAGE_IMPACT_OPTIONS.map((option) => (
            <MenuItem
              key={option.key}
              selected={option.key === impactLevel}
              onClick={() => {
                setSelectedImpactLevel(option.key);
                handlePageChange(currentPage);
                setImpactOnEl(null);
              }}>
              {option.icon}
              {option.label}
            </MenuItem>
          ))}
        </StyledMenu>
      </div>
    );
  }, [navigate, streamButtonGroup, impactOnEl, impactLevel]);

  // Function to fetch nodes based on current filters and pagination
  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);

      if (impactLevel === EImpactLevel.ColumnLevel) {
        const res = await getLineageDataByFQN({
          fqn,
          entityType,
          config: lineageConfig,
          queryFilter,
        });

        const upstreamEdges = map(res.upstreamEdges ?? [], (edge) => edge);
        const downstreamEdges = map(res.downstreamEdges ?? [], (edge) => edge);
        const upstreamNodes = prepareUpstreamColumnLevelNodesFromUpstreamEdges(
          upstreamEdges,
          res.nodes
        ) as unknown as LineageNode[];

        const downstreamNodes =
          prepareDownstreamColumnLevelNodesFromDownstreamEdges(
            downstreamEdges,
            res.nodes
          ) as unknown as LineageNode[];

        setColumnLineageNodes(upstreamNodes, downstreamNodes);
        handlePagingChange({
          total:
            lineageDirection === LineageDirection.Upstream
              ? upstreamNodes.length
              : downstreamNodes.length,
        } as Paging);
      } else {
        const res = await getLineageByEntityCount({
          fqn: fqn ?? '',
          type: entityType ?? '',
          direction: lineageDirection,
          nodeDepth: nodeDepth,
          from: (currentPage - 1) * pageSize,
          size: pageSize,
          query_filter: queryFilter,
        });

        delete res.nodes[fqn];

        setFilterNodes(
          sortBy(
            map(
              res.nodes,
              ({ entity, paging, nodeDepth }) =>
                ({
                  ...entity,
                  ...paging,
                  nodeDepth,
                } as unknown as LineageNode)
            ),
            'nodeDepth'
          )
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching nodes:', error);
      setFilterNodes([]);
    } finally {
      setLoading(false);
    }
  }, [
    lineageDirection,
    queryFilter,
    entityType,
    fqn,
    nodeDepth,
    currentPage,
    pageSize,
    impactLevel,
    lineageConfig,
  ]);

  // Fetch Lineage data when dependencies change
  useEffect(() => {
    fetchNodes();
  }, [nodeDepth, currentPage, impactLevel, pageSize, queryFilter]);

  useEffect(() => {
    if (impactLevel === EImpactLevel.TableLevel) {
      fetchNodes();
    } else {
      // Since setState is async, we show loading manually to avoid flicker
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }
  }, [lineageDirection]);

  useEffect(() => {
    updateEntityData(entityType, entity, false);
  }, [entityType, entity]);

  const nodeDepthOptions = useMemo(() => {
    return (
      (lineageDirection === LineageDirection.Downstream
        ? lineagePagingInfo?.downstreamDepthInfo
        : lineagePagingInfo?.upstreamDepthInfo) ?? []
    ).map((info) => info.depth);
  }, [
    lineageDirection,
    lineagePagingInfo?.downstreamDepthInfo,
    lineagePagingInfo?.upstreamDepthInfo,
  ]);

  const filterNodeIds = useMemo(() => {
    return filterNodes.map((node) => node.id ?? '');
  }, [filterNodes]);

  // Card header with search and filter options
  const cardHeader = useMemo(() => {
    return (
      <CustomControlsComponent
        nodeDepthOptions={nodeDepthOptions}
        queryFilterNodeIds={filterNodeIds}
        searchValue={searchValue}
        onSearchValueChange={setSearchValue}
      />
    );
  }, [searchValue, lineagePagingInfo, nodeDepthOptions, filterNodeIds]);

  // Render function for column names with search highlighting
  const renderName = useCallback(
    (_: string, record: SearchSourceAlias) => (
      <Link
        to={getEntityLinkFromType(
          record.fullyQualifiedName ?? '',
          record.entityType as EntityType,
          record
        )}>
        {stringToHTML(highlightSearchText(getEntityName(record), searchValue))}
      </Link>
    ),
    [searchValue]
  );

  // Define columns for table-level impact analysis
  const tableColumns: ColumnsType<SearchSourceAlias> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        sorter: true,
        render: renderName,
      },
      {
        title: t('label.node-depth'),
        dataIndex: 'nodeDepth',
        key: 'nodeDepth',
        render: (depth: number) => (
          // Keep a fallback to 0 if depth is NaN for any unexpected reason
          <span>{Number.isNaN(Math.abs(depth)) ? 0 : Math.abs(depth)}</span>
        ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (text: string) => <span>{text}</span>,
      },
      {
        title: t('label.domain-plural'),
        dataIndex: 'domains',
        key: 'domains',
        render: (domains: EntityReference[]) => (
          <DomainLabel
            multiple
            domains={domains}
            entityFqn=""
            entityId=""
            entityType={entityType}
            showDomainHeading={false}
          />
        ),
      },
      {
        title: t('label.owner-plural'),
        dataIndex: 'owners',
        key: 'owners',
        render: (owners: EntityReference[]) => (
          <OwnerLabel isCompactView={false} owners={owners} showLabel={false} />
        ),
      },
      {
        title: t('label.tier'),
        dataIndex: 'tier',
        key: 'tier',
        render: (tier: TagLabel) => {
          if (!tier) {
            return NO_DATA;
          }

          return <TierTag tier={tier} />;
        },
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
        render: (
          tags: TagLabel[],
          record: SearchedDataProps['data'][number]['_source'],
          index: number
        ) =>
          isEmpty(tags) ? (
            NO_DATA
          ) : (
            <TableTags
              isReadOnly
              newLook
              entityFqn=""
              entityType={record.entityType as EntityType}
              handleTagSelection={() => Promise.resolve()}
              hasTagEditAccess={false}
              index={index}
              record={record}
              showInlineEditTagButton={false}
              tags={tags}
              type={TagSource.Classification}
            />
          ),
      },
      {
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        key: 'glossary-terms',
        render: (
          tags: TagLabel[],
          record: SearchedDataProps['data'][number]['_source'],
          index: number
        ) =>
          isEmpty(tags) ? (
            NO_DATA
          ) : (
            <TableTags
              isReadOnly
              newLook
              entityFqn=""
              entityType={record.entityType as EntityType}
              handleTagSelection={() => Promise.resolve()}
              hasTagEditAccess={false}
              index={index}
              record={record}
              showInlineEditTagButton={false}
              tags={tags}
              type={TagSource.Glossary}
            />
          ),
      },
    ],
    [t, renderName]
  );

  // Render function for column names with search highlighting
  const columnNameRender = useCallback(
    (column: string | string[]) => {
      const columnNames = Array.isArray(column) ? column.join(', ') : column;

      const prunedColumnName = getPartialNameFromTableFQN(columnNames, [
        FqnPart.Column,
      ]);

      return (
        <span>
          {isEmpty(prunedColumnName)
            ? NO_DATA
            : highlightSearchText(prunedColumnName, searchValue)}
        </span>
      );
    },
    [lineageDirection, searchValue]
  );

  // Define columns for column-level impact analysis
  const columnImpactColumns: ColumnsType<SearchSourceAlias> = useMemo(
    () => [
      {
        title: t('label.source'),
        dataIndex:
          lineageDirection === LineageDirection.Downstream
            ? 'fromEntity'
            : 'toEntity',
        key:
          lineageDirection === LineageDirection.Downstream
            ? 'fromEntity'
            : 'toEntity',
        sorter: true,
        render: (record?: SearchSourceAlias & { type: EntityType }) => (
          <Link
            to={getEntityLinkFromType(
              record?.fullyQualifiedName ?? '',
              record?.type as EntityType,
              record
            )}>
            {stringToHTML(
              highlightSearchText(
                getPartialNameFromTableFQN(record?.fullyQualifiedName ?? '', [
                  FqnPart.Table,
                ]),
                searchValue
              )
            )}
          </Link>
        ),
      },
      {
        title: t('label.source-column-plural'),
        dataIndex:
          lineageDirection === LineageDirection.Downstream
            ? ['column', 'fromColumns']
            : ['column', 'toColumn'],
        key:
          lineageDirection === LineageDirection.Downstream
            ? 'column.fromColumns'
            : 'column.toColumn',
        sorter: true,
        render: columnNameRender,
      },
      {
        title: t('label.impacted'),
        dataIndex:
          lineageDirection === LineageDirection.Upstream
            ? 'fromEntity'
            : 'toEntity',
        key:
          lineageDirection === LineageDirection.Upstream
            ? 'fromEntity'
            : 'toEntity',
        sorter: true,
        render: (record?: SearchSourceAlias & { type?: EntityType }) => (
          <Link
            to={getEntityLinkFromType(
              record?.fullyQualifiedName ?? '',
              record?.type as EntityType,
              record
            )}>
            {stringToHTML(
              highlightSearchText(
                getPartialNameFromTableFQN(record?.fullyQualifiedName ?? '', [
                  FqnPart.Table,
                ]),
                searchValue
              )
            )}
          </Link>
        ),
      },
      {
        title: t('label.impacted-column-plural'),
        dataIndex:
          lineageDirection === LineageDirection.Upstream
            ? ['column', 'fromColumns']
            : ['column', 'toColumn'],
        key:
          lineageDirection === LineageDirection.Upstream
            ? 'column.fromColumns'
            : 'column.toColumn',
        sorter: true,
        render: columnNameRender,
      },
      ...tableColumns.slice(1),
    ],
    [t, tableColumns, lineageDirection]
  );

  // Initialize quick filters on component mount
  useEffect(() => {
    const items =
      impactLevel === EImpactLevel.TableLevel
        ? LINEAGE_DROPDOWN_ITEMS
        : LINEAGE_DROPDOWN_ITEMS.filter(
            (item) =>
              ![EntityFields.TAG, EntityFields.COLUMN].includes(item.key)
          );
    const updatedQuickFilters = items.map((selectedFilterItem) => {
      const originalFilterItem = selectedQuickFilters?.find(
        (filter) => filter.key === selectedFilterItem.key
      );

      return {
        ...(originalFilterItem || selectedFilterItem),
        // preserve original values if exists else set to empty array
        value: originalFilterItem?.value || [],
        hideCounts: impactLevel === EImpactLevel.ColumnLevel ? true : false,
      };
    });

    if (updatedQuickFilters.length > 0) {
      setSelectedQuickFilters(updatedQuickFilters);
    }
  }, [impactLevel]);

  // Determine columns and dataSource based on impactLevel
  const { columns, dataSource } = useMemo(() => {
    if (impactLevel === EImpactLevel.TableLevel) {
      return {
        columns: tableColumns,
        dataSource: filterNodes,
      };
    } else {
      const nodes =
        lineageDirection === LineageDirection.Downstream
          ? downstreamColumnLineageNodes.slice(
              currentPage - 1,
              currentPage - 1 + pageSize
            )
          : upstreamColumnLineageNodes;

      const source = nodes.slice(currentPage - 1, currentPage - 1 + pageSize);

      return {
        columns: columnImpactColumns,
        dataSource: source,
      };
    }
  }, [
    impactLevel,
    filterNodes,
    tableColumns,
    columnImpactColumns,
    lineageDirection,
    downstreamColumnLineageNodes,
    upstreamColumnLineageNodes,
    pageSize,
    currentPage,
  ]);

  // Memoized paging props to avoid unnecessary re-renders
  const pagingProps = useMemo(() => {
    return {
      paging,
      pageSize,
      currentPage,
      isNumberBased: true,
      showPagination,
      onShowSizeChange: handlePageSizeChange,
      pagesizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
      pagingHandler: (data: PagingHandlerParams) => {
        handlePageChange(data.currentPage);
      },
    };
  }, [pageSize, currentPage, showPagination, paging, handlePageSizeChange]);

  // Fetch paging data when fqn, entityType, or queryFilter changes
  useEffect(() => {
    const fetchPagingData = async () => {
      const lineagePagingData = await getLineagePagingData({
        fqn: fqn ?? '',
        type: entityType ?? '',
        query_filter: queryFilter,
      });

      setLineagePagingInfo(lineagePagingData);
    };

    fetchPagingData();
  }, [fqn, entityType, queryFilter]);

  return (
    <Card
      className={classNames({ isFullScreen }, 'lineage-card')}
      title={cardHeader}>
      <Table
        bordered
        className="h-full"
        columns={columns}
        customPaginationProps={pagingProps}
        dataSource={dataSource}
        defaultVisibleColumns={IMPACT_ANALYSIS_DEFAULT_VISIBLE_COLUMNS}
        entityType="impact_analysis"
        extraTableFilters={extraTableFilters}
        key={`lineage-table-${impactLevel}-${lineageDirection}`}
        loading={loading}
        locale={{
          emptyText: <NoDataPlaceholder size={SIZE.LARGE} />,
        }}
        pagination={false}
        rowKey={
          impactLevel === EImpactLevel.TableLevel
            ? 'fullyQualifiedName'
            : 'docId'
        }
        staticVisibleColumns={IMPACT_ANALYSIS_STATIC_COLUMNS}
      />
    </Card>
  );
};

export default LineageTable;
