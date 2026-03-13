/*
 *  Copyright 2022 Collate.
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

import {
  Button,
  ButtonUtility,
  Dropdown,
  Tabs,
  Tooltip,
  TooltipTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import QueryString from 'qs';
import {
  FC,
  memo,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DropdownIcon } from '../../../assets/svg/drop-down.svg';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as DownloadIcon } from '../../../assets/svg/ic-download.svg';
import { ReactComponent as ExitFullScreenIcon } from '../../../assets/svg/ic-exit-fullscreen.svg';
import { ReactComponent as FilterLinesIcon } from '../../../assets/svg/ic-filter-lines.svg';
import { ReactComponent as FullscreenIcon } from '../../../assets/svg/ic-fullscreen.svg';
import { ReactComponent as SettingsOutlined } from '../../../assets/svg/ic-settings-gear.svg';
import { LINEAGE_DROPDOWN_ITEMS } from '../../../constants/AdvancedSearch.constants';
import {
  AGGREGATE_PAGE_SIZE_LARGE,
  FULLSCREEN_QUERY_PARAM_KEY,
} from '../../../constants/constants';
import { ExportTypes } from '../../../constants/Export.constants';
import { SERVICE_TYPES } from '../../../constants/Services.constant';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../../context/LineageProvider/LineageProvider.interface';
import { EntityType } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { LineageDirection } from '../../../generated/api/lineage/entityCountLineageRequest';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../hooks/useFqn';
import { useLineageStore } from '../../../hooks/useLineageStore';
import { QueryFieldInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { exportLineageByEntityCountAsync } from '../../../rest/lineageAPI';
import { getQuickFilterQuery } from '../../../utils/ExploreUtils';
import { getSearchNameEsQuery } from '../../../utils/Lineage/LineageUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import { LineageConfig } from './EntityLineage.interface';
import LineageConfigModal from './LineageConfigModal';
import LineageSearchSelect from './LineageSearchSelect/LineageSearchSelect';

const CustomControls: FC<{
  nodeDepthOptions?: number[];
  onSearchValueChange?: (value: string) => void;
  searchValue?: string;
  queryFilterNodeIds?: string[];
  deleted?: boolean;
  hasEditAccess?: boolean;
}> = ({
  nodeDepthOptions,
  onSearchValueChange,
  searchValue,
  queryFilterNodeIds,
  deleted = false,
  hasEditAccess = false,
}) => {
  const { t } = useTranslation();
  const {
    setSelectedQuickFilters,
    nodes,
    selectedQuickFilters,
    onExportClick,
  } = useLineageProvider();
  const {
    lineageConfig,
    toggleEditMode,
    isEditMode,
    platformView,
    setLineageConfig,
  } = useLineageStore();
  const [filterSelectionActive, setFilterSelectionActive] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { fqn } = useFqn();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();

  const queryFilter = useMemo(() => {
    const nodeIds = (nodes ?? [])
      .map((node) => node.data?.node?.id)
      .filter(Boolean);

    return {
      query: {
        bool: {
          must: {
            terms: {
              'id.keyword': queryFilterNodeIds ?? nodeIds,
            },
          },
        },
      },
    };
  }, [nodes, queryFilterNodeIds]);

  // Query filter for table data & search values
  const quickFilters = useMemo(() => {
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

  // Initialize quick filters on component mount
  useEffect(() => {
    const updatedQuickFilters = LINEAGE_DROPDOWN_ITEMS.map(
      (selectedFilterItem) => {
        const originalFilterItem = selectedQuickFilters?.find(
          (filter) => filter.key === selectedFilterItem.key
        );

        return {
          ...(originalFilterItem || selectedFilterItem),
          value: originalFilterItem?.value || [],
        };
      }
    );

    if (updatedQuickFilters.length > 0) {
      setSelectedQuickFilters(updatedQuickFilters);
    }
  }, []);

  const queryParams = useMemo(() => {
    return QueryString.parse(location.search, {
      ignoreQueryPrefix: true,
    });
  }, [location.search]);

  const { isFullScreen, nodeDepth, lineageDirection, activeTab } =
    useMemo(() => {
      const lineageDirection =
        queryParams['dir'] === LineageDirection.Upstream
          ? LineageDirection.Upstream
          : LineageDirection.Downstream;

      const directionalDepth =
        lineageDirection === LineageDirection.Downstream
          ? lineageConfig.downstreamDepth
          : lineageConfig.upstreamDepth;

      const nodeDepth = Number.isNaN(Number(queryParams['depth']))
        ? directionalDepth
        : Number(queryParams['depth']);

      return {
        activeTab:
          queryParams['mode'] === 'impact_analysis'
            ? 'impact_analysis'
            : 'lineage',
        isFullScreen: queryParams[FULLSCREEN_QUERY_PARAM_KEY] === 'true',
        nodeDepth,
        lineageDirection,
      };
    }, [
      queryParams,
      lineageConfig.downstreamDepth,
      lineageConfig.upstreamDepth,
    ]);

  const handleTabChange = useCallback(
    (key: string) => {
      queryParams['mode'] = key;
      navigate({ search: QueryString.stringify(queryParams) });
    },
    [navigate, queryParams]
  );

  const updateURLParams = useCallback(
    (
      data: Partial<{
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

  const toggleFilterSelection: MouseEventHandler<HTMLButtonElement> =
    useCallback(() => {
      setFilterSelectionActive((prev) => !prev);
      // In case of filters we need to bring fullscreen mode if not
      if (!filterSelectionActive) {
        // update fullscreen param in url
        updateURLParams({
          [FULLSCREEN_QUERY_PARAM_KEY]: !filterSelectionActive,
        });
      }
    }, [filterSelectionActive, updateURLParams]);

  const handleClearAllFilters = useCallback(() => {
    setSelectedQuickFilters((prev) =>
      (prev ?? []).map((filter) => ({ ...filter, value: [] }))
    );
  }, [setSelectedQuickFilters]);

  // Function to handle export click
  const handleImpactAnalysisExport = useCallback(
    () =>
      exportLineageByEntityCountAsync({
        fqn: fqn ?? '',
        type: entityType ?? '',
        direction: lineageDirection,
        nodeDepth: nodeDepth,
        query_filter: quickFilters,
      }),
    [fqn, entityType, lineageDirection, nodeDepth, quickFilters]
  );

  const handleExportClick = useCallback(() => {
    if (activeTab === 'impact_analysis') {
      onExportClick([ExportTypes.CSV], handleImpactAnalysisExport);
    } else {
      onExportClick([ExportTypes.CSV, ExportTypes.PNG]);
    }
  }, [activeTab, onExportClick]);

  const handleDialogSave = (newConfig: LineageConfig) => {
    // Implement save logic here
    setLineageConfig(newConfig);
    setDialogVisible(false);
  };

  const filterApplied = useMemo(() => {
    return selectedQuickFilters.some(
      (filter) => (filter.value ?? []).length > 0
    );
  }, [selectedQuickFilters]);

  const searchBarComponent = useMemo(() => {
    return activeTab === 'impact_analysis' ? (
      onSearchValueChange && (
        <Searchbar
          removeMargin
          inputClassName="w-80"
          placeholder={t('label.search-for-type', {
            type: t('label.asset-or-column'),
          })}
          searchValue={searchValue}
          typingInterval={300}
          onSearch={onSearchValueChange}
        />
      )
    ) : (
      <LineageSearchSelect />
    );
  }, [searchValue, onSearchValueChange]);

  const handleNodeDepthUpdate = useCallback(
    (depth: number) => {
      updateURLParams({ depth });
    },
    [updateURLParams]
  );
  const lineageEditButton = useMemo(() => {
    const showEditOption =
      hasEditAccess &&
      !deleted &&
      platformView === LineagePlatformView.None &&
      entityType &&
      !SERVICE_TYPES.includes(entityType as AssetsUnion);

    return showEditOption ? (
      <Tooltip
        placement="top"
        title={t('label.edit-entity', { entity: t('label.lineage') })}>
        <TooltipTrigger>
          <Button
            color={isEditMode ? 'primary' : 'secondary'}
            data-testid="edit-lineage"
            iconLeading={EditIcon}
            onClick={toggleEditMode}
          />
        </TooltipTrigger>
      </Tooltip>
    ) : null;
  }, [
    hasEditAccess,
    deleted,
    platformView,
    entityType,
    isEditMode,
    toggleEditMode,
    t,
  ]);

  const settingsButton = useMemo(() => {
    const handleSettingsClick = () => {
      setDialogVisible(true);
    };

    return (
      <ButtonUtility
        data-testid="lineage-config"
        icon={SettingsOutlined}
        onClick={handleSettingsClick}
      />
    );
  }, []);

  return (
    <div>
      <div className={classNames('tw:flex tw:w-full tw:justify-between')}>
        <div className="tw:flex tw:items-center tw:gap-4">
          <Tooltip placement="top" title={t('label.filter-plural')}>
            <TooltipTrigger>
              <Button
                aria-label={t('label.filter-plural')}
                color={filterSelectionActive ? 'primary' : 'secondary'}
                data-testid="filters-button"
                iconLeading={FilterLinesIcon}
                onClick={toggleFilterSelection}
              />
            </TooltipTrigger>
          </Tooltip>
          {searchBarComponent}
        </div>
        <div className="tw:flex tw:gap-4 tw:items-center">
          {isEditMode ? null : (
            <Tabs
              selectedKey={activeTab}
              onSelectionChange={(key) => handleTabChange(key as string)}>
              <Tabs.List size="sm" type="button-brand">
                <Tabs.Item id="lineage" key="lineage">
                  {t('label.lineage')}
                </Tabs.Item>
                <Tabs.Item id="impact_analysis" key="impact_analysis">
                  {t('label.impact-analysis')}
                </Tabs.Item>
              </Tabs.List>
            </Tabs>
          )}

          {lineageEditButton}
          <Tooltip
            placement="top"
            title={
              activeTab === 'impact_analysis'
                ? t('label.export-as-type', { type: t('label.csv') })
                : t('label.export')
            }>
            <TooltipTrigger>
              <ButtonUtility
                aria-label={
                  activeTab === 'impact_analysis'
                    ? t('label.export-as-type', { type: t('label.csv') })
                    : t('label.export')
                }
                data-testid="export-button"
                disabled={isEditMode}
                icon={DownloadIcon}
                onClick={handleExportClick}
              />
            </TooltipTrigger>
          </Tooltip>
          {settingsButton}
          <Tooltip
            placement="top"
            title={
              isFullScreen
                ? t('label.exit-full-screen')
                : t('label.full-screen-view')
            }>
            <TooltipTrigger>
              <ButtonUtility
                aria-label={
                  isFullScreen
                    ? t('label.exit-full-screen')
                    : t('label.full-screen-view')
                }
                icon={isFullScreen ? ExitFullScreenIcon : FullscreenIcon}
                onClick={() =>
                  updateURLParams({
                    [FULLSCREEN_QUERY_PARAM_KEY]: !isFullScreen,
                  })
                }
              />
            </TooltipTrigger>
          </Tooltip>
        </div>
      </div>
      {filterSelectionActive ? (
        <div className="tw:mt-2 tw:flex tw:items-center tw:justify-between">
          <div className="tw:flex tw:items-baseline">
            {activeTab === 'impact_analysis' && (
              <Dropdown.Root>
                <Button className="tw:px-3.5 tw:py-2.5" color="tertiary">
                  <div className="tw:flex tw:items-center tw:gap-1">
                    <Typography as="span" className="tw:font-normal">
                      {`${t('label.node-depth')}:`}{' '}
                    </Typography>
                    <Typography
                      as="span"
                      className="tw:text-brand-600 tw:font-normal">
                      {nodeDepth}
                    </Typography>
                    <DropdownIcon height={12} width={12} />
                  </div>
                </Button>
                <Dropdown.Popover className="tw:max-w-32">
                  <Dropdown.Menu
                    aria-label={t('label.node-depth')}
                    onAction={(key) => handleNodeDepthUpdate(Number(key))}>
                    {(nodeDepthOptions ?? []).map((depth) => (
                      <Dropdown.Item
                        className={depth === nodeDepth ? 'tw:text-primary' : ''}
                        key={depth}>
                        {depth}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown.Root>
            )}
            <ExploreQuickFilters
              independent
              aggregations={{}}
              defaultQueryFilter={queryFilter}
              fields={selectedQuickFilters}
              index={SearchIndex.ALL}
              optionPageSize={AGGREGATE_PAGE_SIZE_LARGE}
              showDeleted={false}
              onFieldValueSelect={handleQuickFiltersValueSelect}
            />
          </div>
          <Button
            color="link-color"
            isDisabled={!filterApplied}
            size="sm"
            onClick={handleClearAllFilters}>
            {t('label.clear-entity', { entity: t('label.all') })}
          </Button>
        </div>
      ) : (
        <></>
      )}

      <LineageConfigModal
        config={lineageConfig}
        visible={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onSave={handleDialogSave}
      />
    </div>
  );
};

export default memo(CustomControls);
