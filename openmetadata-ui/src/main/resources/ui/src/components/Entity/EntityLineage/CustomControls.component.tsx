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

import { Button, MenuItem, Tooltip, useTheme } from '@mui/material';
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
import { QueryFieldInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import { exportLineageByEntityCountAsync } from '../../../rest/lineageAPI';
import { getQuickFilterQuery } from '../../../utils/ExploreUtils';
import { getSearchNameEsQuery } from '../../../utils/Lineage/LineageUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import Searchbar from '../../common/SearchBarComponent/SearchBar.component';
import { AssetsUnion } from '../../DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import {
  StyledIconButton,
  StyledMenu,
} from '../../LineageTable/LineageTable.styled';
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
    lineageConfig,
    onExportClick,
    onLineageConfigUpdate,
    onLineageEditClick,
    isEditMode,
    platformView,
  } = useLineageProvider();
  const [filterSelectionActive, setFilterSelectionActive] = useState(false);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [nodeDepthAnchorEl, setNodeDepthAnchorEl] =
    useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useCustomLocation();
  const theme = useTheme();
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

  const handleImpactAnalysisClick = useCallback(() => {
    queryParams['mode'] = 'impact_analysis';
    navigate({ search: QueryString.stringify(queryParams) });
  }, [navigate, queryParams]);

  const handleLineageClick = useCallback(() => {
    queryParams['mode'] = 'lineage';
    navigate({ search: QueryString.stringify(queryParams) });
  }, [navigate, queryParams]);

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
      setNodeDepthAnchorEl(null);
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
    onLineageConfigUpdate?.(newConfig);
    setDialogVisible(false);
  };

  const buttonActiveStyle = {
    outlineColor: theme.palette.allShades.blue[700],
    backgroundColor: theme.palette.allShades.blue[50],
    color: theme.palette.allShades.blue[700],
    outline: '1px solid',
    boxShadow: 'none',

    '&:hover': {
      outlineColor: theme.palette.allShades.blue[100],
      backgroundColor: theme.palette.allShades.blue[100],
      color: theme.palette.allShades.blue[700],
      boxShadow: 'none',
    },
  };

  const filterApplied = useMemo(() => {
    return selectedQuickFilters.some(
      (filter) => (filter.value ?? []).length > 0
    );
  }, [selectedQuickFilters]);

  const searchBarComponent = useMemo(() => {
    return activeTab === 'impact_analysis' && onSearchValueChange ? (
      <Searchbar
        removeMargin
        inputClassName="w-80"
        placeholder={t('label.search-for-type', {
          type: t('label.asset-or-column'),
        })}
        searchValue={searchValue}
        typingInterval={0}
        onSearch={onSearchValueChange}
      />
    ) : (
      <LineageSearchSelect />
    );
  }, [searchValue, onSearchValueChange]);

  const handleNodeDepthUpdate = useCallback(
    (depth: number) => {
      updateURLParams({ depth });
      setNodeDepthAnchorEl(null);
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
        arrow
        placement="top"
        title={t('label.edit-entity', { entity: t('label.lineage') })}>
        <StyledIconButton
          color={isEditMode ? 'primary' : 'default'}
          data-testid="edit-lineage"
          size="large"
          onClick={onLineageEditClick}>
          <EditIcon />
        </StyledIconButton>
      </Tooltip>
    ) : null;
  }, [
    hasEditAccess,
    deleted,
    platformView,
    entityType,
    isEditMode,
    onLineageEditClick,
    t,
  ]);

  const settingsButton = useMemo(() => {
    const handleSettingsClick = () => {
      setDialogVisible(true);
    };

    return (
      <StyledIconButton
        data-testid="lineage-config"
        size="large"
        onClick={handleSettingsClick}>
        <SettingsOutlined />
      </StyledIconButton>
    );
  }, []);

  return (
    <div>
      <div className={classNames('d-flex w-full justify-between')}>
        <div className="d-flex items-center gap-4">
          <Tooltip arrow placement="top" title={t('label.filter-plural')}>
            <StyledIconButton
              color={filterSelectionActive ? 'primary' : 'default'}
              size="large"
              onClick={toggleFilterSelection}>
              <FilterLinesIcon />
            </StyledIconButton>
          </Tooltip>
          {searchBarComponent}
        </div>
        <div className="d-flex gap-4 items-center">
          {isEditMode ? null : (
            <>
              <Button
                className="font-semibold"
                sx={activeTab === 'lineage' ? buttonActiveStyle : {}}
                variant="outlined"
                onClick={handleLineageClick}>
                {t('label.lineage')}
              </Button>
              <Button
                className="font-semibold"
                sx={activeTab === 'impact_analysis' ? buttonActiveStyle : {}}
                variant="outlined"
                onClick={handleImpactAnalysisClick}>
                {t('label.impact-analysis')}
              </Button>{' '}
            </>
          )}

          {lineageEditButton}
          <Tooltip
            arrow
            placement="top"
            title={
              activeTab === 'impact_analysis'
                ? t('label.export-as-type', { type: t('label.csv') })
                : t('label.export')
            }>
            <StyledIconButton
              disabled={isEditMode}
              size="large"
              onClick={handleExportClick}>
              <DownloadIcon />
            </StyledIconButton>
          </Tooltip>
          {settingsButton}
          <Tooltip
            arrow
            placement="top"
            title={
              isFullScreen
                ? t('label.exit-full-screen')
                : t('label.full-screen-view')
            }>
            <StyledIconButton
              size="large"
              onClick={() =>
                updateURLParams({ [FULLSCREEN_QUERY_PARAM_KEY]: !isFullScreen })
              }>
              {isFullScreen ? <ExitFullScreenIcon /> : <FullscreenIcon />}
            </StyledIconButton>
          </Tooltip>
        </div>
      </div>
      {filterSelectionActive ? (
        <div className="m-t-sm d-flex items-center justify-between">
          <div>
            {activeTab === 'impact_analysis' && (
              <>
                <Button
                  endIcon={<DropdownIcon />}
                  sx={{
                    fontWeight: 500,
                    '& .MuiButton-endIcon': {
                      svg: {
                        height: 12,
                      },
                    },
                  }}
                  variant="text"
                  onClick={(e) => setNodeDepthAnchorEl(e.currentTarget)}>
                  {`${t('label.node-depth')}:`}{' '}
                  <span className="text-primary m-l-xss">{nodeDepth}</span>
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
                  {(nodeDepthOptions ?? [])?.map((depth) => (
                    <MenuItem
                      key={depth}
                      selected={depth === nodeDepth}
                      onClick={() => handleNodeDepthUpdate(depth)}>
                      {depth}
                    </MenuItem>
                  ))}
                </StyledMenu>
              </>
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
            disabled={!filterApplied}
            size="small"
            sx={{
              fontWeight: 500,
              color: theme.palette.primary.main,
            }}
            variant="text"
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
