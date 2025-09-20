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
/* eslint-disable i18next/no-literal-string */
import { SettingOutlined } from '@ant-design/icons';
import {
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  MenuProps,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
} from '@mui/material';
import { ColumnsType } from 'antd/es/table';
import Card from 'antd/lib/card/Card';
import classNames from 'classnames';
import { find, isEmpty, map, sortBy } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../assets/svg/drop-down.svg';
import { ReactComponent as ColumnIcon } from '../../assets/svg/ic-column.svg';
import { ReactComponent as DownloadIcon } from '../../assets/svg/ic-download.svg';
import { ReactComponent as FilterLinesIcon } from '../../assets/svg/ic-filter-lines.svg';
import { ReactComponent as TableIcon } from '../../assets/svg/ic-table.svg';
import { ReactComponent as TrendDownIcon } from '../../assets/svg/ic-trend-down.svg';
import { LINEAGE_DROPDOWN_ITEMS } from '../../constants/AdvancedSearch.constants';
import { NO_DATA, PAGE_SIZE_LARGE } from '../../constants/constants';
import { ExportTypes } from '../../constants/Export.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { EntityType, FqnPart } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { EntityReference } from '../../generated/tests/testCase';
import { Paging } from '../../generated/type/paging';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { SearchSourceAlias } from '../../interface/search.interface';
import { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import {
  exportLineageByEntityCountAsync,
  getLineageByEntityCount,
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
  prepareDownstreamColumnLevelNodesFromDownstreamEdges,
  prepareUpstreamColumnLevelNodesFromUpstreamEdges,
} from '../../utils/Lineage/LineageUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { DomainLabel } from '../common/DomainLabel/DomainLabel.component';
import { PagingHandlerParams } from '../common/NextPrevious/NextPrevious.interface';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import Searchbar from '../common/SearchBarComponent/SearchBar.component';
import Table from '../common/Table/Table';
import TierTag from '../common/TierTag';
import TableTags from '../Database/TableTags/TableTags.component';
import { LineageConfig } from '../Entity/EntityLineage/EntityLineage.interface';
import LineageConfigModal from '../Entity/EntityLineage/LineageConfigModal';
import { ExploreQuickFilterField } from '../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../Explore/ExploreQuickFilters';
import { LineageNode } from '../Lineage/Lineage.interface';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import './lineage-table.less';
import { EImpactLevel } from './LineageTable.interface';
import { useLineageTableState } from './useLineageTableState';

export const ImpactOptions = [
  { label: 'Table Level', key: EImpactLevel.TableLevel, icon: <TableIcon /> },
  {
    label: 'Column Level',
    key: EImpactLevel.ColumnLevel,
    icon: <ColumnIcon />,
  },
];

const StyledMenu = styled((props: MenuProps) => <Menu {...props} />)(
  ({ theme }) => ({
    '& .MuiPaper-root': {
      width: 'auto',
      '& .MuiMenu-list': {
        padding: '0',
      },
      '& .MuiMenuItem-root': {
        margin: '0',
        padding: '10px 16px',
        borderRadius: '0px',
        '& svg': {
          height: 24,
          marginRight: theme.spacing(1.5),
        },
        '&:active': {
          backgroundColor: theme.palette.allShades.blue[25],
        },
        '&.Mui-selected': {
          backgroundColor: theme.palette.allShades.blue[25],
          color: theme.palette.allShades.blue[700],
        },
        '&:hover': {
          backgroundColor: theme.palette.allShades.blue[25],
        },
      },
    },
  })
);

const LineageTable = () => {
  const {
    selectedQuickFilters,
    setSelectedQuickFilters,
    lineageConfig,
    onExportClick,
    onLineageConfigUpdate,
  } = useLineageProvider();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Use the custom hook for state management
  const {
    filterNodes,
    loading,
    filterSelectionActive,
    searchValue,
    dialogVisible,
    impactLevel,
    upstreamColumnLineageNodes,
    downstreamColumnLineageNodes,
    lineagePagingInfo,
    setFilterNodes,
    setLoading,
    setSearchValue,
    setDialogVisible,
    setImpactLevel: setSelectedImpactLevel,
    setColumnLineageNodes,
    setLineagePagingInfo,
    toggleFilterSelection,
  } = useLineageTableState();
  const {
    currentPage,
    pageSize,
    paging,
    showPagination,
    handlePageChange,
    handlePagingChange,
  } = usePaging(PAGE_SIZE_LARGE);
  const theme = useTheme();

  const [impactOnEl, setImpactOnEl] = useState<null | HTMLElement>(null);
  const [nodeDepthAnchorEl, setNodeDepthAnchorEl] =
    useState<null | HTMLElement>(null);

  const { isFullScreen, nodeDepth, lineageDirection } = useMemo(() => {
    const queryParams = QueryString.parse(
      location.search.endsWith('?')
        ? location.search.slice(0, -1)
        : location.search
    );

    return {
      isFullScreen: queryParams['fullscreen'] === 'true',
      nodeDepth: Number(queryParams['depth']) || 1,
      lineageDirection:
        (queryParams['dir'] as LineageDirection) || LineageDirection.Downstream,
    };
  }, [location.search]);

  const defaultQueryFilter = useMemo(() => {
    const nodeIds = (filterNodes ?? [])
      .map((node) => node?.id ?? '')
      .filter(Boolean);

    return {
      query: {
        bool: {
          must: {
            terms: {
              'id.keyword': nodeIds,
            },
          },
        },
      },
    };
  }, [filterNodes]);

  const handleDialogSave = (newConfig: LineageConfig) => {
    // Implement save logic here
    onLineageConfigUpdate?.(newConfig);
    setDialogVisible(false);
  };

  const updateURLParams = useCallback(
    (
      data: Partial<{
        dir: LineageDirection;
        depth: number;
        fullscreen: boolean;
      }>
    ) => {
      const search = location.search.endsWith('?')
        ? location.search.slice(0, -1)
        : location.search;
      const params = QueryString.parse(search);
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          params[key] = String(value);
        }
      });

      navigate(
        `${location.pathname}${QueryString.stringify(params, {
          encode: false,
        })}`,
        { replace: true }
      );
      setNodeDepthAnchorEl(null);
    },
    [location.search]
  );

  // Get upstream and downstream count when fqn, entityType, lineageDirection or nodeDepth changes
  const { upstreamCount, downstreamCount } = useMemo(() => {
    if (impactLevel === EImpactLevel.ColumnLevel) {
      return {
        upstreamCount: upstreamColumnLineageNodes.length,
        downstreamCount: downstreamColumnLineageNodes.length,
      };
    }

    const upstreamCount =
      find(
        lineagePagingInfo?.upstreamDepthInfo,
        (record) => record.depth === nodeDepth
      )?.entityCount ?? 0;
    const downstreamCount =
      find(
        lineagePagingInfo?.downstreamDepthInfo,
        (record) => record.depth === nodeDepth
      )?.entityCount ?? 0;

    return { upstreamCount, downstreamCount };
  }, [
    lineagePagingInfo,
    nodeDepth,
    impactLevel,
    upstreamColumnLineageNodes,
    downstreamColumnLineageNodes,
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
      <ToggleButtonGroup
        exclusive
        className="lineage-button-group"
        size="small"
        sx={{
          '.MuiToggleButton-root': {
            padding: theme.spacing(2, 4),
            '&.Mui-selected': {
              outlineColor: theme.palette.allShades.blue[700],
              backgroundColor: theme.palette.allShades.blue[50],
              color: theme.palette.allShades.blue[700],

              '.MuiChip-root': {
                color: theme.palette.allShades.blue[700],
                backgroundColor: theme.palette.allShades.blue[100],
              },
              '&:hover': {
                backgroundColor: theme.palette.allShades.blue[100],
              },
            },
            '&:hover': {
              outlineColor: theme.palette.allShades.blue[100],
              backgroundColor: theme.palette.allShades.blue[100],
              color: theme.palette.allShades.blue[700],
            },
            color: theme.palette.allShades.gray[700],
            '.MuiChip-root': {
              marginLeft: theme.spacing(1.5),
              border: 'none',
              borderRadius: theme.spacing(4),
              backgroundColor: theme.palette.allShades.gray[100],
            },
          },
        }}
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
      </ToggleButtonGroup>
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

  // Function to handle export click
  const handleExportClick = useCallback(
    () =>
      exportLineageByEntityCountAsync({
        fqn: fqn ?? '',
        type: entityType ?? '',
        direction: lineageDirection,
        nodeDepth: nodeDepth,
        from: (currentPage - 1) * pageSize,
        size: pageSize,
        queryFilter,
      }),
    [
      fqn,
      entityType,
      lineageDirection,
      nodeDepth,
      currentPage,
      pageSize,
      queryFilter,
    ]
  );

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
          onClick={(event) => setImpactOnEl(event.currentTarget)}>
          <Transi18next
            i18nKey="label.impact-on-area"
            renderElement={<span className="text-primary" />}
            values={{ area: t(`label.${impactLevel}`) }}
          />
        </Button>
        <StyledMenu
          anchorEl={impactOnEl}
          open={Boolean(impactOnEl)}
          onClose={() => setImpactOnEl(null)}>
          {ImpactOptions.map((option) => (
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
  }, [navigate, streamButtonGroup, impactOnEl, impactLevel, handleExportClick]);

  // Function to handle quick filter value selection
  const handleQuickFiltersValueSelect = useCallback(
    (field: ExploreQuickFilterField) => {
      setSelectedQuickFilters((pre) => {
        const data = pre.map((preField) => {
          if (preField.key === field.key) {
            return field;
          } else {
            return preField;
          }
        });

        return data;
      });
    },
    [setSelectedQuickFilters]
  );

  // Function to fetch nodes based on current filters and pagination
  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLineageByEntityCount({
        fqn: fqn ?? '',
        type: entityType ?? '',
        direction: lineageDirection,
        nodeDepth: nodeDepth,
        from: (currentPage - 1) * pageSize,
        size: pageSize,
        queryFilter,
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

      const upstreamEdges = map(res.upstreamEdges ?? [], (edge) => edge);
      const downstreamEdges = map(res.downstreamEdges ?? [], (edge) => edge);

      setColumnLineageNodes(
        prepareUpstreamColumnLevelNodesFromUpstreamEdges(
          upstreamEdges,
          res.nodes
        ) as unknown as LineageNode[],
        prepareDownstreamColumnLevelNodesFromDownstreamEdges(
          downstreamEdges,
          res.nodes
        ) as unknown as LineageNode[]
      );
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
  ]);

  // Fetch Lineage data when dependencies change
  useEffect(() => {
    fetchNodes();
  }, [queryFilter, nodeDepth, currentPage, lineageDirection]);

  // Card header with search and filter options
  const cardHeader = useMemo(() => {
    return (
      <>
        <div className="d-flex justify-between items-center">
          <div className="d-flex gap-2">
            <IconButton
              className={classNames('filter-icon-button', {
                active: filterSelectionActive,
              })}
              size="large"
              sx={{
                padding: '11px 8px',
                '& svg': {
                  height: 18,
                  color: '#535862',
                },
              }}
              title={t('label.filter-plural')}
              onClick={toggleFilterSelection}>
              <FilterLinesIcon />
            </IconButton>

            <Searchbar
              removeMargin
              placeholder={t('label.search-for-type', {
                type: t('label.entity'),
              })}
              searchValue={searchValue}
              typingInterval={0}
              onSearch={setSearchValue}
            />
          </div>
          <div className="d-flex gap-2">
            <Button
              className="font-semibold"
              variant="outlined"
              onClick={() => navigate({ search: '?mode=lineage' })}>
              {t('label.lineage')}
            </Button>
            <Button
              className="font-semibold"
              sx={{
                outlineColor: theme.palette.allShades.blue[700],
                backgroundColor: theme.palette.allShades.blue[50],
                color: theme.palette.allShades.blue[700],
                '&:hover': {
                  outlineColor: theme.palette.allShades.blue[100],
                  backgroundColor: theme.palette.allShades.blue[100],
                  color: theme.palette.allShades.blue[700],
                },
              }}
              variant="outlined"
              onClick={() => navigate({ search: '?mode=impact_analysis' })}>
              {t('label.impact-analysis')}
            </Button>
            <Tooltip title="Export as CSV">
              <IconButton
                size="large"
                sx={{
                  padding: '11px 8px',
                  '& svg': {
                    height: 18,
                    color: '#535862',
                  },
                }}
                onClick={() =>
                  onExportClick([ExportTypes.CSV], handleExportClick)
                }>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <IconButton
              size="large"
              sx={{
                padding: '11px 8px',
                '& svg': {
                  height: 18,
                  color: '#535862',
                },
              }}
              onClick={() => setDialogVisible(true)}>
              <SettingOutlined />
            </IconButton>
          </div>
        </div>
        {filterSelectionActive ? (
          <div className="m-t-sm">
            <Button
              endIcon={<DropdownIcon />}
              sx={{
                '& .MuiButton-endIcon': {
                  svg: {
                    height: 12,
                  },
                },
              }}
              variant="text"
              onClick={(e) => setNodeDepthAnchorEl(e.currentTarget)}>
              {t('label.node-depth')}
              <span className="text-primary">: {nodeDepth}</span>
            </Button>
            <StyledMenu
              anchorEl={nodeDepthAnchorEl}
              open={Boolean(nodeDepthAnchorEl)}
              slotProps={{
                paper: {
                  style: {
                    maxHeight: 48 * 4.5,
                    width: '10ch',
                  },
                },
                list: {
                  'aria-labelledby': 'long-button',
                },
              }}
              onClose={() => setNodeDepthAnchorEl(null)}>
              {lineagePagingInfo?.downstreamDepthInfo.map(({ depth }) => (
                <MenuItem
                  key={depth}
                  selected={depth === nodeDepth}
                  onClick={() => {
                    handlePageChange(1);
                    updateURLParams({ depth });
                  }}>
                  {depth}
                </MenuItem>
              ))}
            </StyledMenu>
            <ExploreQuickFilters
              independent
              aggregations={{}}
              defaultQueryFilter={defaultQueryFilter}
              fields={selectedQuickFilters}
              index={SearchIndex.ALL}
              showDeleted={false}
              onFieldValueSelect={handleQuickFiltersValueSelect}
            />
          </div>
        ) : (
          <></>
        )}
      </>
    );
  }, [
    searchValue,
    defaultQueryFilter,
    selectedQuickFilters,
    filterSelectionActive,
    handleQuickFiltersValueSelect,
    toggleFilterSelection,
    filterSelectionActive,
    handleExportClick,
    onExportClick,
    updateURLParams,
    nodeDepth,
    lineagePagingInfo,
    nodeDepthAnchorEl,
    navigate,
    t,
  ]);

  // Render function for column names with search highlighting
  const renderName = useCallback(
    (_: string, record: SearchSourceAlias) => (
      <Link
        to={getEntityLinkFromType(
          record.fullyQualifiedName ?? '',
          EntityType.TABLE,
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
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        sorter: true,
        render: renderName,
      },
      {
        title: 'Node Depth',
        dataIndex: 'nodeDepth',
        key: 'nodeDepth',
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (text: string) => <span>{text}</span>,
      },
      {
        title: 'Domain',
        dataIndex: 'domains',
        key: 'domains',
        render: (domains: EntityReference[]) => (
          <DomainLabel
            multiple
            domains={domains}
            entityFqn=""
            entityId=""
            entityType={EntityType.TABLE}
            showDomainHeading={false}
          />
        ),
      },
      {
        title: 'Owners',
        dataIndex: 'owners',
        key: 'owners',
        render: (owners: EntityReference[]) => (
          <OwnerLabel
            avatarSize={24}
            isCompactView={false}
            owners={owners}
            showLabel={false}
          />
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
        title: 'Tags',
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
        title: 'Source Table',
        dataIndex:
          lineageDirection === LineageDirection.Downstream
            ? 'fromEntity'
            : 'toEntity',
        key:
          lineageDirection === LineageDirection.Downstream
            ? 'fromEntity'
            : 'toEntity',
        sorter: true,
        render: (record?: SearchSourceAlias) => (
          <Link
            to={getEntityLinkFromType(
              record?.fullyQualifiedName ?? '',
              EntityType.TABLE,
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
        title: 'Source Column',
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
        title: 'Impacted Table',
        dataIndex:
          lineageDirection === LineageDirection.Upstream
            ? 'fromEntity'
            : 'toEntity',
        key:
          lineageDirection === LineageDirection.Upstream
            ? 'fromEntity'
            : 'toEntity',
        sorter: true,
        render: (record?: SearchSourceAlias) => (
          <Link
            to={getEntityLinkFromType(
              record?.fullyQualifiedName ?? '',
              EntityType.TABLE,
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
        title: 'Impacted Columns',
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
    const updatedQuickFilters = LINEAGE_DROPDOWN_ITEMS.map(
      (selectedFilterItem) => {
        const originalFilterItem = selectedQuickFilters?.find(
          (filter) => filter.key === selectedFilterItem.key
        );

        return { ...(originalFilterItem || selectedFilterItem), value: [] };
      }
    );

    const newItems = updatedQuickFilters.filter(
      (item) =>
        !selectedQuickFilters.some(
          (existingItem) => item.key === existingItem.key
        )
    );

    if (newItems.length > 0) {
      setSelectedQuickFilters(newItems);
    }

    // Toggle fullscreen view based on filter selection
    updateURLParams({ fullscreen: filterSelectionActive });
  }, []);

  // Determine columns and dataSource based on impactLevel
  const { columns, dataSource } = useMemo(() => {
    if (impactLevel === 'table') {
      return {
        columns: tableColumns,
        dataSource: filterNodes,
      };
    } else {
      const source =
        lineageDirection === LineageDirection.Downstream
          ? downstreamColumnLineageNodes
          : upstreamColumnLineageNodes;

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
  ]);

  // Update paging total when lineagePagingInfo, lineageDirection, or nodeDepth changes
  useEffect(() => {
    handlePagingChange({
      total:
        lineageDirection === LineageDirection.Downstream
          ? lineagePagingInfo?.downstreamDepthInfo.find(
              (info) => info.depth === nodeDepth
            )?.entityCount
          : lineagePagingInfo?.upstreamDepthInfo.find(
              (info) => info.depth === nodeDepth
            )?.entityCount,
    } as Paging);
  }, [lineagePagingInfo, lineageDirection, nodeDepth]);

  // Memoized paging props to avoid unnecessary re-renders
  const pagingProps = useMemo(() => {
    return {
      paging,
      pageSize,
      currentPage,
      isNumberBased: true,
      showPagination,
      pagingHandler: (data: PagingHandlerParams) => {
        handlePageChange(data.currentPage);
      },
    };
  }, [nodeDepth, pageSize, currentPage, showPagination]);

  // Fetch paging data when fqn, entityType, or queryFilter changes
  useEffect(() => {
    const fetchPagingData = async () => {
      const lineagePagingData = await getLineagePagingData({
        fqn: fqn ?? '',
        type: entityType ?? '',
        queryFilter,
      });

      setLineagePagingInfo(lineagePagingData);
    };

    fetchPagingData();
  }, [fqn, entityType, queryFilter]);

  return (
    <Card className={classNames({ isFullScreen })} title={cardHeader}>
      <Table
        bordered
        columns={columns}
        customPaginationProps={pagingProps}
        dataSource={dataSource}
        defaultVisibleColumns={[
          'name',
          'owners',
          'nodeDepth',
          'toEntity',
          'fromEntity',
          'column.toColumn',
          'column.fromColumns',
        ]}
        extraTableFilters={extraTableFilters}
        loading={loading}
        pagination={false}
        rowKey={impactLevel === 'table' ? 'fullyQualifiedName' : 'docId'}
        staticVisibleColumns={['name', 'column']}
      />

      <LineageConfigModal
        config={lineageConfig}
        visible={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onSave={handleDialogSave}
      />
    </Card>
  );
};

export default LineageTable;
