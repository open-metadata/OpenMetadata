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
import { Grid, Tooltip } from '@mui/material';
import { Expand05, Home02, Minimize02 } from '@untitledui/icons';
import { Card, Select } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { AxiosError } from 'axios';
import { debounce, startCase } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as DownloadIcon } from '../../assets/svg/ic-download.svg';
import { ReactComponent as SettingsOutlined } from '../../assets/svg/ic-settings-gear.svg';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { AssetsUnion } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import { useEntityExportModalProvider } from '../../components/Entity/EntityExportModalProvider/EntityExportModalProvider.component';
import { LineageConfig } from '../../components/Entity/EntityLineage/EntityLineage.interface';
import EntitySuggestionOption from '../../components/Entity/EntityLineage/EntitySuggestionOption/EntitySuggestionOption.component';
import LineageConfigModal from '../../components/Entity/EntityLineage/LineageConfigModal';
import Lineage from '../../components/Lineage/Lineage.component';
import { StyledIconButton } from '../../components/LineageTable/LineageTable.styled';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import {
  FULLSCREEN_QUERY_PARAM_KEY,
  PAGE_SIZE_BASE,
} from '../../constants/constants';
import {
  ExportTypes,
  LINEAGE_EXPORT_SELECTOR,
} from '../../constants/Export.constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import LineageProvider from '../../context/LineageProvider/LineageProvider';
import { LineagePlatformView } from '../../context/LineageProvider/LineageProvider.interface';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import {
  LineageSettings,
  PipelineViewMode,
} from '../../generated/configuration/lineageSettings';
import { EntityReference } from '../../generated/entity/type';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../hooks/useFqn';
import { getEntityPermissionByFqn } from '../../rest/permissionAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getEntityAPIfromSource } from '../../utils/Assets/AssetsUtils';
import { getCurrentISODate } from '../../utils/date-time/DateTimeUtils';
import {
  getLineageEntityExclusionFilter,
  getViewportForLineageExport,
} from '../../utils/EntityLineageUtils';
import { getOperationPermissions } from '../../utils/PermissionsUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './platform-lineage.less';

const PlatformLineage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();

  const { fqn: decodedFqn } = useFqn();
  const [selectedEntity, setSelectedEntity] = useState<SourceType>();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<DefaultOptionType[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [defaultValue, setDefaultValue] = useState<string | undefined>(
    decodedFqn || undefined
  );
  const { appPreferences } = useApplicationStore();
  const defaultLineageConfig = appPreferences?.lineageConfig as LineageSettings;

  const [lineageConfig, setLineageConfig] = useState<LineageConfig>({
    downstreamDepth: defaultLineageConfig?.downstreamDepth ?? 1,
    upstreamDepth: defaultLineageConfig?.upstreamDepth ?? 1,
    nodesPerLayer: 50,
    pipelineViewMode:
      defaultLineageConfig?.pipelineViewMode ?? PipelineViewMode.Node,
  });
  const [permissions, setPermissions] = useState<OperationPermission>();
  const [dialogVisible, setDialogVisible] = useState(false);
  const { showModal } = useEntityExportModalProvider();

  const queryParams = useMemo(() => {
    return QueryString.parse(location.search, {
      ignoreQueryPrefix: true,
    });
  }, [location.search]);

  const { platformView, isFullScreen } = useMemo(() => {
    return {
      isFullScreen: queryParams[FULLSCREEN_QUERY_PARAM_KEY] === 'true',
      platformView:
        (queryParams['platformView'] as LineagePlatformView) ??
        LineagePlatformView.Service,
    };
  }, [queryParams]);

  const handleEntitySelect = useCallback(
    (value: EntityReference) => {
      navigate(
        `/lineage/${(value as SourceType).entityType}/${getEncodedFqn(
          value.fullyQualifiedName ?? ''
        )}`
      );
    },
    [navigate]
  );
  const debouncedSearch = useCallback(
    debounce(async (value: string) => {
      try {
        setIsSearchLoading(true);
        const searchIndices = [
          SearchIndex.DATA_ASSET,
          SearchIndex.DOMAIN,
          SearchIndex.SERVICE,
        ];

        const response = await searchQuery({
          query: value,
          searchIndex: searchIndices,
          pageSize: PAGE_SIZE_BASE,
          queryFilter: getLineageEntityExclusionFilter(),
          includeDeleted: false,
        });

        setOptions(
          response.hits.hits.map((hit) => ({
            value: hit._source.fullyQualifiedName ?? '',
            label: (
              <EntitySuggestionOption
                showEntityTypeBadge
                entity={hit._source as EntityReference}
                onSelectHandler={handleEntitySelect}
              />
            ),
            data: hit,
          }))
        );
      } finally {
        setIsSearchLoading(false);
      }
    }, 300),
    []
  );

  const init = useCallback(async () => {
    if (!decodedFqn || !entityType) {
      setDefaultValue(undefined);

      return;
    }

    try {
      setLoading(true);
      const [entityResponse, permissionResponse] = await Promise.allSettled([
        getEntityAPIfromSource(entityType as AssetsUnion)(decodedFqn),
        getEntityPermissionByFqn(
          entityType as unknown as ResourceEntity,
          decodedFqn
        ),
      ]);

      if (entityResponse.status === 'fulfilled') {
        setSelectedEntity(entityResponse.value);
        setDefaultValue(decodedFqn || undefined);
      }

      if (permissionResponse.status === 'fulfilled') {
        const operationPermission = getOperationPermissions(
          permissionResponse.value
        );
        setPermissions(operationPermission);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, [decodedFqn, entityType]);

  const handleExport = useCallback(() => {
    showModal({
      name: `${t('label.lineage')}_${getCurrentISODate()}`,
      exportTypes: [ExportTypes.PNG],
      title: t('label.lineage'),
      documentSelector: LINEAGE_EXPORT_SELECTOR,
      viewport: getViewportForLineageExport([], LINEAGE_EXPORT_SELECTOR),
      onExport: async () => '',
    });
  }, []);

  useEffect(() => {
    init();
  }, [init]);

  const handleSettingsClick = () => {
    setDialogVisible(true);
  };

  const handleDialogSave = (config: LineageConfig) => {
    setLineageConfig(config);
    setDialogVisible(false);
  };

  const header = useMemo(() => {
    return (
      <div className="d-flex justify-between items-center">
        <Select
          showSearch
          className="w-1\/2"
          data-testid="search-entity-select"
          filterOption={false}
          loading={isSearchLoading}
          optionLabelProp="value"
          options={options}
          placeholder={t('label.search-entity-for-lineage', {
            entity: 'entity',
          })}
          value={defaultValue}
          onFocus={() => !defaultValue && debouncedSearch('')}
          onSearch={debouncedSearch}
        />
        <div className="d-flex gap-2">
          <Tooltip
            arrow
            placement="top"
            title={t('label.export-as-type', {
              type: t('label.png-uppercase'),
            })}>
            <StyledIconButton size="large" onClick={handleExport}>
              <DownloadIcon />
            </StyledIconButton>
          </Tooltip>
          <StyledIconButton
            data-testid="lineage-config"
            size="large"
            onClick={handleSettingsClick}>
            <SettingsOutlined />
          </StyledIconButton>
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
                navigate({
                  search: QueryString.stringify({
                    ...queryParams,
                    [FULLSCREEN_QUERY_PARAM_KEY]: !isFullScreen,
                  }),
                })
              }>
              {isFullScreen ? <Minimize02 /> : <Expand05 />}
            </StyledIconButton>
          </Tooltip>
        </div>
      </div>
    );
  }, [
    isFullScreen,
    options,
    defaultValue,
    debouncedSearch,
    isSearchLoading,
    handleExport,
    navigate,
    queryParams,
  ]);

  const lineageElement = useMemo(() => {
    if (loading) {
      return <Loader />;
    }

    return (
      <LineageProvider>
        <Lineage
          isPlatformLineage
          entity={selectedEntity}
          entityType={entityType}
          hasEditAccess={
            permissions?.EditAll || permissions?.EditLineage || false
          }
          platformHeader={header}
        />
      </LineageProvider>
    );
  }, [selectedEntity, loading, permissions, entityType, header]);

  return (
    <PageLayoutV1 pageTitle={t('label.lineage')}>
      <Grid container spacing={2}>
        {isFullScreen ? null : (
          <>
            <Grid size={12}>
              <TitleBreadcrumb
                useCustomArrow
                titleLinks={[
                  {
                    name: '',
                    icon: <Home02 size={12} />,
                    url: '/',
                    activeTitle: true,
                  },
                  {
                    name: t('label.lineage'),
                    url: '',
                  },
                ]}
              />
            </Grid>

            <Grid size={12}>
              <Card>
                <PageHeader
                  data={{
                    header: t('label.platform-type-lineage', {
                      platformType: startCase(platformView),
                    }),
                    subHeader: t(PAGE_HEADERS.PLATFORM_LINEAGE.subHeader),
                  }}
                  learningPageId={LEARNING_PAGE_IDS.LINEAGE}
                  title={t('label.lineage')}
                />
              </Card>
            </Grid>
          </>
        )}
        <Grid size={12}>
          <div className="platform-lineage-container">{lineageElement}</div>
        </Grid>
      </Grid>

      <LineageConfigModal
        config={lineageConfig}
        visible={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onSave={handleDialogSave}
      />
    </PageLayoutV1>
  );
};

export default PlatformLineage;
