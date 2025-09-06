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
  FilterOutlined,
  SettingOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import { ColumnsType } from 'antd/es/table';
import ButtonGroup from 'antd/lib/button/button-group';
import Card from 'antd/lib/card/Card';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import { get, isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../assets/svg/drop-down.svg';
import { ReactComponent as DownloadIcon } from '../../assets/svg/ic-download.svg';
import { ReactComponent as SwitchVerticalIcon } from '../../assets/svg/ic-switch-vertical.svg';
import { ReactComponent as TrendDownIcon } from '../../assets/svg/ic-trend-down.svg';
import { NO_DATA } from '../../constants/constants';
import { LINEAGE_DEFAULT_QUICK_FILTERS } from '../../constants/Lineage.constants';
import { useLineageProvider } from '../../context/LineageProvider/LineageProvider';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/tests/testCase';
import { TagLabel, TagSource } from '../../generated/type/tagLabel';
import { useFqn } from '../../hooks/useFqn';
import { SearchSourceAlias } from '../../interface/search.interface';
import { getAssetsPageQuickFilters } from '../../utils/AdvancedSearchUtils';
import {
  getEntityLinkFromType,
  highlightSearchText,
} from '../../utils/EntityUtils';
import { stringToHTML } from '../../utils/StringsUtils';
import { DomainLabel } from '../common/DomainLabel/DomainLabel.component';
import { OwnerLabel } from '../common/OwnerLabel/OwnerLabel.component';
import Searchbar from '../common/SearchBarComponent/SearchBar.component';
import Table from '../common/Table/Table';
import TierTag from '../common/TierTag';
import TableTags from '../Database/TableTags/TableTags.component';
import { ExploreQuickFilterField } from '../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../Explore/ExploreQuickFilters';
import { AssetsOfEntity } from '../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchedDataProps } from '../SearchedData/SearchedData.interface';
import './lineage-table.less';

interface LineageTableProps {
  onPageChange?: (page: number) => void;
  currentPage?: number;
  total?: number;
}

const LineageTable: React.FC<LineageTableProps> = ({
  onPageChange,
  currentPage = 1,
  total = 0,
}) => {
  const { nodes, selectedQuickFilters, setSelectedQuickFilters } =
    useLineageProvider();
  const { fqn } = useFqn();
  const [currentNodeData, setCurrentNodeData] = useState(null);
  const [filterNodes, setFilterNodes] = useState<SearchSourceAlias[]>(
    nodes?.map((n) => n.data.node) as SearchSourceAlias[]
  );
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);

  const [searchValue, setSearchValue] = React.useState<string>('');
  const onSearch = useCallback(
    (text: string) => {
      // Implement search logic here
      setSearchValue(text);

      setFilterNodes(
        nodes
          .map((node) => {
            const nodeData = node.data.node;

            return nodeData.name.toLowerCase().includes(text.toLowerCase())
              ? nodeData
              : null;
          })
          .filter(Boolean)
      );
    },
    [nodes]
  );

  const [selectedStream, setSelectedStream] =
    React.useState<string>('upstream');

  const radioGroupOptions = useMemo(() => {
    return [
      {
        label:
          'Upstream ' + get(currentNodeData, 'paging.entityUpstreamCount', 0),

        value: 'upstream',
      },
      {
        label:
          'Downstream ' +
          get(currentNodeData, 'paging.entityDownstreamCount', 0),
        value: 'downstream',
      },
    ];
  }, [currentNodeData]);

  const extraTableFilters = useMemo(() => {
    return (
      <div className="d-flex justify-between items-center w-full">
        <div>
          <ButtonGroup className="lineage-button-group" size="small">
            {radioGroupOptions.map((option) => (
              <Button
                className="font-semibold"
                ghost={selectedStream === option.value}
                key={option.value}
                type={selectedStream === option.value ? 'primary' : 'default'}
                onClick={() => setSelectedStream(option.value)}>
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
            }}>
            <Button icon={<Icon component={SwitchVerticalIcon} />} type="text">
              Dependency <Icon component={DropdownIcon} />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: [
                { label: 'Column Level', key: 'column_level' },
                { label: 'Domain', key: 'domain' },
                { label: 'Owner', key: 'owner' },
              ],
            }}>
            <Button
              icon={<Icon component={TrendDownIcon} size={24} />}
              type="text">
              Impact On <Icon component={DropdownIcon} />
            </Button>
          </Dropdown>
          <Button
            icon={<Icon component={DownloadIcon} size={24} />}
            type="text">
            Download
          </Button>
        </div>
      </div>
    );
  }, [navigate, radioGroupOptions, selectedStream]);

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

  const queryFilter = useMemo(() => {
    const nodeIds = (nodes ?? [])
      .map((node) => node.data?.node?.id)
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
  }, [nodes]);

  useEffect(() => {
    const activeNode = nodes.find(
      (node) => node.data.node.fullyQualifiedName === fqn
    );

    activeNode
      ? setCurrentNodeData(activeNode.data.node)
      : setCurrentNodeData(null);
  }, [nodes]);

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

  const cardHeader = useMemo(() => {
    return (
      <>
        <div className="d-flex justify-between items-center">
          <div className="d-flex gap-2">
            <Dropdown
              menu={{
                items: filterMenu,
                selectedKeys: selectedFilter,
              }}
              trigger={['click']}>
              <Button
                ghost
                className="expand-btn"
                icon={<FilterOutlined />}
                type="primary"
              />
            </Dropdown>

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
            <Button icon={<SettingOutlined />} />
          </div>
        </div>
        <ExploreQuickFilters
          independent
          aggregations={{}}
          defaultQueryFilter={queryFilter}
          fields={selectedQuickFilters}
          index={SearchIndex.ALL}
          showDeleted={false}
          onFieldValueSelect={handleQuickFiltersValueSelect}
        />
      </>
    );
  }, [
    searchValue,
    onSearch,
    selectedQuickFilters,
    filterMenu,
    selectedFilter,
    queryFilter,
  ]);

  const paginationProps = useMemo(() => {
    return {
      current: currentPage,
      total,
      pageSize: 10,
      onChange: onPageChange,
      showSizeChanger: false,
    };
  }, [currentPage, onPageChange, total]);

  const renderName = useCallback(
    (text: string, record: SearchSourceAlias) => (
      <Link
        to={getEntityLinkFromType(
          record.fullyQualifiedName ?? '',
          EntityType.TABLE,
          record
        )}>
        {stringToHTML(highlightSearchText(text, searchValue))}
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

    const defaultFilterValues = dropdownItems
      .filter((item) => LINEAGE_DEFAULT_QUICK_FILTERS.includes(item.key))
      .map((item) => item.key);

    setSelectedFilter(defaultFilterValues);
  }, []);

  return (
    <Card title={cardHeader}>
      <Table
        bordered
        columns={columns}
        dataSource={filterNodes}
        extraTableFilters={extraTableFilters}
        pagination={paginationProps}
        rowKey="name"
      />
    </Card>
  );
};

export default LineageTable;
