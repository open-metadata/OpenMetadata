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
import Icon, {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SettingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { ColumnsType } from 'antd/es/table';
import ButtonGroup from 'antd/lib/button/button-group';
import Card from 'antd/lib/card/Card';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { get, isEmpty, map } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../assets/svg/drop-down.svg';
import { ReactComponent as DownloadIcon } from '../../assets/svg/ic-download.svg';
import { ReactComponent as SwitchVerticalIcon } from '../../assets/svg/ic-switch-vertical.svg';
import { ReactComponent as TrendDownIcon } from '../../assets/svg/ic-trend-down.svg';
import { NO_DATA, PAGE_SIZE_LARGE } from '../../constants/constants';
import { ExportTypes } from '../../constants/Export.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { LineageDirection } from '../../generated/api/lineage/lineageDirection';
import { EntityReference } from '../../generated/tests/testCase';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { usePaging } from '../../hooks/paging/usePaging';
import { useFqn } from '../../hooks/useFqn';
import { SearchSourceAlias } from '../../interface/search.interface';
import { QueryFieldInterface } from '../../pages/ExplorePage/ExplorePage.interface';
import { getLineageDataByFQN } from '../../rest/lineageAPI';
import { getAssetsPageQuickFilters } from '../../utils/AdvancedSearchUtils';
import {
  getEntityLinkFromType,
  getEntityName,
  highlightSearchText,
} from '../../utils/EntityUtils';
import { getQuickFilterQuery } from '../../utils/ExploreUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { DomainLabel } from '../common/DomainLabel/DomainLabel.component';
import { FilterLinesIconButton } from '../common/IconButtons/EditIconButton';
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
import { AssetsOfEntity } from '../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import './lineage-table.less';

enum EImpactLevel {
  TableLevel = 'table_level',
  ColumnLevel = 'column_level',
}

const ImpactOptions = [
  { label: 'Table Level', key: EImpactLevel.TableLevel },
  { label: 'Column Level', key: EImpactLevel.ColumnLevel },
];

const LineageTable = () => {
  const {
    entityLineage,
    selectedQuickFilters,
    setSelectedQuickFilters,
    lineageConfig,
    onExportClick,
    onLineageConfigUpdate,
    fetchLineageData,
  } = useLineageProvider();
  const { fqn } = useFqn();
  const [currentNodeData, setCurrentNodeData] =
    useState<SearchSourceAlias | null>(null);
  const [filterNodes, setFilterNodes] = useState<SearchSourceAlias[]>([]);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();
  const [filterSelectionActive, setFilterSelectionActive] = useState(false);
  const [searchValue, setSearchValue] = React.useState<string>('');
  const { currentPage, pageSize, handlePageChange } =
    usePaging(PAGE_SIZE_LARGE);
  const [dialogVisible, setDialogVisible] = useState<boolean>(false);
  const [impactLevel, setSelectedImpactLevel] = useState<EImpactLevel>(
    EImpactLevel.TableLevel
  );
  const [selectedDependencyType, setSelectedDependencyType] =
    useState<string>('direct');

  const queryParams = new URLSearchParams(location.search);
  const isFullScreen = queryParams.get('fullscreen') === 'true';

  const handleDialogSave = (newConfig: LineageConfig) => {
    // Implement save logic here
    onLineageConfigUpdate?.(newConfig);
    setDialogVisible(false);
  };

  const onSearch = useCallback((text: string) => {
    // Implement search logic here
    setSearchValue(text);
  }, []);

  const [lineageDirection, setLineageDirection] =
    React.useState<LineageDirection>(LineageDirection.Downstream);

  const isFilterVisible = useMemo(() => {
    return filterSelectionActive || isFullScreen;
  }, [filterSelectionActive, isFullScreen]);

  const radioGroupOptions = useMemo(() => {
    return [
      {
        label:
          'Upstream ' + get(currentNodeData, 'paging.entityUpstreamCount', 0),

        value: LineageDirection.Upstream,
      },
      {
        label:
          'Downstream ' +
          get(currentNodeData, 'paging.entityDownstreamCount', 0),
        value: LineageDirection.Downstream,
      },
    ];
  }, [currentNodeData]);

  const reqLineageConfig = useMemo(() => {
    const upstreamDepth =
      selectedDependencyType === 'direct'
        ? 1
        : lineageDirection === LineageDirection.Upstream
        ? 2
        : 0;

    const downstreamDepth =
      selectedDependencyType === 'direct'
        ? 1
        : lineageDirection === LineageDirection.Downstream
        ? 2
        : 0;

    return {
      upstreamDepth,
      downstreamDepth,
      nodesPerLayer: 5,
    };
  }, [lineageDirection, selectedDependencyType]);

  const extraTableFilters = useMemo(() => {
    return (
      <div className="d-flex justify-between items-center w-full">
        <div>
          <ButtonGroup className="lineage-button-group" size="small">
            {radioGroupOptions.map((option) => (
              <Button
                className="font-semibold"
                ghost={lineageDirection === option.value}
                key={option.value}
                type={lineageDirection === option.value ? 'primary' : 'default'}
                onClick={() => setLineageDirection(option.value)}>
                {option.label}
              </Button>
            ))}
          </ButtonGroup>
        </div>
        <div className="d-flex gap-4 items-center">
          <Dropdown
            menu={{
              items: [
                {
                  label: 'Direct',
                  key: 'direct',
                  icon: <ArrowRightOutlined />,
                },
                {
                  label: 'Indirect',
                  key: 'indirect',
                  icon: <ArrowLeftOutlined />,
                },
              ],
              onSelect: ({ key }) => {
                setSelectedDependencyType(key);
              },
            }}>
            <Button icon={<Icon component={SwitchVerticalIcon} />} type="text">
              Dependency <Icon component={DropdownIcon} />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: ImpactOptions,
              onSelect: ({ key }) => {
                setSelectedImpactLevel(key as EImpactLevel);
              },
            }}>
            <Button
              icon={<Icon component={TrendDownIcon} size={24} />}
              type="text">
              Impact On <Icon component={DropdownIcon} />{' '}
              <span>
                {
                  ImpactOptions.find((option) => option.key === impactLevel)
                    ?.label
                }
              </span>
            </Button>
          </Dropdown>
          <Button
            icon={<Icon component={DownloadIcon} size={24} />}
            type="text"
            onClick={() => onExportClick([ExportTypes.CSV])}>
            Download
          </Button>
        </div>
      </div>
    );
  }, [navigate, radioGroupOptions, lineageDirection]);

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedFilter((prevSelected) => [...prevSelected, key]);
  };

  const filterMenu: ItemType[] = useMemo(() => {
    return filters.map((filter) => ({
      key: filter.key,
      label: filter.label,
      onClick: handleMenuClick,
    }));
  }, [filters]);

  useEffect(() => {
    const activeNode = entityLineage.nodes?.find(
      (node) => node.fullyQualifiedName === fqn
    ) as SearchSourceAlias;

    activeNode ? setCurrentNodeData(activeNode) : setCurrentNodeData(null);
  }, [entityLineage.nodes]);

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

  const queryFilter = useMemo(() => {
    const quickFilterQuery = getQuickFilterQuery(selectedQuickFilters);
    const mustClauses: QueryFieldInterface[] = [];

    // Add quick filter conditions (e.g., service field conditions)
    if (quickFilterQuery?.query?.bool?.must) {
      mustClauses.push(...quickFilterQuery.query.bool.must);
    }

    // Add search value conditions for name and displayName using wildcard
    if (searchValue) {
      mustClauses.push({
        bool: {
          should: [
            {
              wildcard: {
                'name.keyword': {
                  value: `*${searchValue}*`,
                },
              },
            },
            {
              wildcard: {
                'displayName.keyword': {
                  value: `*${searchValue}*`,
                },
              },
            },
          ],
        },
      });
    }

    // Build final query only if we have conditions
    const query =
      mustClauses.length > 0
        ? { query: { bool: { must: mustClauses } } }
        : undefined;

    return JSON.stringify(query);
  }, [selectedQuickFilters, searchValue]);

  const fetchNodes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLineageDataByFQN({
        fqn: fqn ?? '',
        entityType: entityType ?? '',
        config: reqLineageConfig, // load only one level of child nodes
        queryFilter,
        direction: lineageDirection,
      });

      delete res.nodes[fqn];

      setFilterNodes(
        map(res.nodes, ({ entity, paging }) => ({ ...entity, ...paging }))
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
    currentNodeData,
    reqLineageConfig,
    entityType,
    fqn,
  ]);

  useEffect(() => {
    fetchNodes();
  }, [selectedFilter, lineageDirection, queryFilter]);

  useEffect(() => {
    if (!currentNodeData) {
      fetchLineageData(fqn, entityType, reqLineageConfig);
    }
  }, [queryFilter, currentNodeData]);

  const toggleFilterSelection = () => {
    setFilterSelectionActive((pre) => !pre);
  };

  const cardHeader = useMemo(() => {
    return (
      <>
        <div className="d-flex justify-between items-center">
          <div className="d-flex gap-2">
            <FilterLinesIconButton
              size="large"
              title={t('label.apply-filters')}
              type={filterSelectionActive ? 'primary' : 'default'}
              onClick={toggleFilterSelection}
            />

            <Searchbar
              placeholder={t('label.search-for-type', {
                type: t('label.entity'),
              })}
              searchValue={searchValue}
              typingInterval={300}
              onSearch={onSearch}
            />
          </div>
          <div className="d-flex gap-2">
            <Button
              className="font-semibold"
              onClick={() => navigate({ search: '?mode=lineage' })}>
              Lineage
            </Button>
            <Button
              ghost
              className="font-semibold"
              type="primary"
              onClick={() => navigate({ search: '?mode=impact_analysis' })}>
              Impact Analysis
            </Button>
            <Button icon={<ShareAltOutlined />} />
            <Button
              icon={<SettingOutlined />}
              onClick={() => setDialogVisible(true)}
            />
          </div>
        </div>
        {isFilterVisible ? (
          <ExploreQuickFilters
            independent
            aggregations={{}}
            fields={selectedQuickFilters}
            index={SearchIndex.ALL}
            showDeleted={false}
            onFieldValueSelect={handleQuickFiltersValueSelect}
          />
        ) : (
          <></>
        )}
      </>
    );
  }, [
    searchValue,
    onSearch,
    selectedQuickFilters,
    filterMenu,
    selectedFilter,
    isFilterVisible,
    handleQuickFiltersValueSelect,
    toggleFilterSelection,
  ]);

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

  const columns: ColumnsType<SearchSourceAlias> = useMemo(
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
        render: (depth: string) => <span>{depth}</span>,
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

  useEffect(() => {
    const updatedQuickFilters = filters
      .filter((filter) => selectedFilter.includes(filter.key))
      .map((selectedFilterItem) => {
        const originalFilterItem = selectedQuickFilters?.find(
          (filter) => filter.key === selectedFilterItem.key
        );

        return originalFilterItem || selectedFilterItem;
      });

    const newItems = updatedQuickFilters.filter(
      (item) =>
        !selectedQuickFilters.some(
          (existingItem) => item.key === existingItem.key
        )
    );

    if (newItems.length > 0) {
      setSelectedQuickFilters((prevSelected) => [...prevSelected, ...newItems]);
    }
  }, [selectedFilter, selectedQuickFilters, filters]);

  useEffect(() => {
    const dropdownItems = getAssetsPageQuickFilters(AssetsOfEntity.LINEAGE);

    setFilters(
      dropdownItems.map((item) => ({
        ...item,
        value: [],
      }))
    );

    const defaultFilterValues = dropdownItems.map((item) => item.key);

    setSelectedFilter(defaultFilterValues);
  }, []);

  const handleLineagePageChange = useCallback(
    ({ currentPage }: PagingHandlerParams) => {
      handlePageChange(currentPage);
    },
    [handlePageChange]
  );

  const pagingProps = useMemo(
    () => ({
      pageSize,
      currentPage,
      paging: {
        total: filterNodes.length,
      },
      pagingHandler: handleLineagePageChange,
      showPagination: true,
    }),
    [pageSize, currentPage, filterNodes.length, handleLineagePageChange]
  );

  return (
    <Card title={cardHeader}>
      <Table
        bordered
        columns={columns}
        customPaginationProps={pagingProps}
        dataSource={filterNodes}
        defaultVisibleColumns={['name', 'owners', 'nodeDepth']}
        extraTableFilters={extraTableFilters}
        loading={loading}
        pagination={false}
        rowKey="name"
        staticVisibleColumns={['name']}
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
