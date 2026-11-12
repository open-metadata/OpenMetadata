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
import {
  ButtonUtility,
  Card,
  FeaturedIcon,
  Grid,
  PageLayout,
} from '@openmetadata/ui-core-components';
import {
  PlatformLineage as PlatformLineageIcon,
  Settings01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import NoDataPlaceholder from '../../components/common/EmptyPlaceholder/NoDataPlaceholder';
import PermissionPlaceholder from '../../components/common/EmptyPlaceholder/PermissionPlaceholder';
import SomethingWentWrongPlaceholder from '../../components/common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import Loader from '../../components/common/Loader/Loader';
import { AssetsUnion } from '../../components/DataAssets/AssetsSelectionModal/AssetSelectionModal.interface';
import DataAssetAsyncSelectList from '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList';
import { DataAssetOption } from '../../components/DataAssets/DataAssetAsyncSelectList/DataAssetAsyncSelectList.interface';
import LineageConfigModal from '../../components/Entity/EntityLineage/LineageConfigModal';
import { LearningIcon } from '../../components/Learning/LearningIcon/LearningIcon.component';
import LineageComponent from '../../components/Lineage/Lineage.component';
import { Lineage } from '../../components/Lineage/Lineage/Lineage';
import LineageExportButton from '../../components/Lineage/LineageExportButton/LineageExportButton';
import {
  getLensLabelKey,
  getSceneRequestFromSearch,
} from '../../components/Lineage/LineageMap/LineageMap.utils';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { SourceType } from '../../components/SearchedData/SearchedData.interface';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { SearchIndex } from '../../enums/search.enum';
import { EntityReference } from '../../generated/entity/type';
import { useIsAiMode } from '../../hooks/useAppMode';
import useCustomLocation from '../../hooks/useCustomLocation/useCustomLocation';
import { useEntityPermissions } from '../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../hooks/useFqn';
import { useLineageStore } from '../../hooks/useLineageStore';
import { LineageConfig } from '../../interface/lineage.interface';
import { getEntityAPIfromSource } from '../../utils/Assets/AssetsUtils';
import { getLineageEntityExclusionFilter } from '../../utils/EntityLineagePureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { getNameFromFQN } from '../../utils/FqnUtils';
import { getEncodedFqn } from '../../utils/StringUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './platform-lineage.less';
import {
  ENTITY_LOAD_ERRORS,
  LENS_BY_ENTITY_TYPE,
} from './PlatformLineage.constants';

const LINEAGE_SEARCH_INDEXES = [
  SearchIndex.DATA_ASSET,
  SearchIndex.DOMAIN,
  SearchIndex.SERVICE,
];

const PlatformLineage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { entityType } = useRequiredParams<{ entityType: EntityType }>();

  const { fqn: decodedFqn } = useFqn();
  const [selectedEntity, setSelectedEntity] = useState<SourceType>();
  const [isEntityLoading, setIsEntityLoading] = useState(false);
  const [entityLoadError, setEntityLoadError] = useState<
    'missing' | 'denied' | 'failed'
  >();
  // Config lives in the Zustand store — Lineage's fetch effect depends on
  // it, so writing here triggers a refetch. Local useState here would leave
  // the store untouched and the depth change would never reach the network.
  const lineageConfig = useLineageStore((state) => state.lineageConfig);
  const setLineageConfig = useLineageStore((state) => state.setLineageConfig);
  const [dialogVisible, setDialogVisible] = useState(false);

  // Fetch-owner, by fqn — `entityType` doubles as the resource here (cast, matching the old
  // code's own `entityType as unknown as ResourceEntity`). Ungated: the old raw
  // `permissions?.EditAll || permissions?.EditLineage` read never referenced `deleted`.
  const {
    isLoading: isPermissionsLoading,
    error: permissionsError,
    canEditLineage,
  } = useEntityPermissions(
    entityType as unknown as ResourceEntity,
    decodedFqn,
    { enabled: Boolean(decodedFqn && entityType) }
  );

  useEffect(() => {
    if (permissionsError) {
      showErrorToast(permissionsError as AxiosError);
    }
  }, [permissionsError]);

  // Combined loading flag: the old `loading` state covered both the entity fetch AND the
  // permission fetch together (a single `Promise.allSettled` awaited by one try/finally).
  // Both fetches now run independently (permission via the hook, entity via `init` below) but
  // neither is gated on the other's result, so a plain OR reproduces the old "loading until
  // both settle" behavior without the denied-case stuck-loading risk that gated fetches have
  // (ServiceVersionPage.tsx precedent — not applicable here since entity fetch isn't
  // permission-gated).
  const loading = isEntityLoading || isPermissionsLoading;

  // The header names the lens the map is drawn through, read the same way
  // the map reads it.
  const { lens, focusFqn } = getSceneRequestFromSearch(
    location.search,
    {},
    true
  );

  const handleEntitySelect = useCallback(
    (value: EntityReference) => {
      const selectedType = (value as SourceType).entityType as EntityType;
      const lineageLens = LENS_BY_ENTITY_TYPE[selectedType];
      void navigate({
        pathname: `/lineage/${selectedType}/${getEncodedFqn(
          value.fullyQualifiedName ?? ''
        )}`,
        search: lineageLens ? `?lineageLens=${lineageLens}` : '',
      });
    },
    [navigate]
  );
  const handleSearchSelect = useCallback(
    (option?: DataAssetOption | DataAssetOption[]) => {
      // Clearing the chip leaves the current lineage on screen.
      if (option && !Array.isArray(option)) {
        handleEntitySelect({
          ...option.reference,
          entityType: option.reference.type,
        } as EntityReference);
      }
    },
    [handleEntitySelect]
  );

  const init = useCallback(async () => {
    // A stale entity would keep the previous map and title on screen.
    setSelectedEntity(undefined);
    setEntityLoadError(undefined);
    if (!decodedFqn || !entityType) {
      return;
    }

    try {
      setIsEntityLoading(true);
      const entityResponse = await getEntityAPIfromSource(
        entityType as AssetsUnion
      )(decodedFqn);
      setSelectedEntity(entityResponse);
    } catch (error) {
      // Permission-fetch errors surface through the hook's own effect above.
      setEntityLoadError(
        ENTITY_LOAD_ERRORS[(error as AxiosError).response?.status ?? 0] ??
          'failed'
      );
    } finally {
      setIsEntityLoading(false);
    }
  }, [decodedFqn, entityType]);

  useEffect(() => {
    init();
  }, [init]);

  const handleSettingsClick = () => {
    setDialogVisible(true);
  };

  const handleDialogSave = useCallback(
    (config: LineageConfig) => {
      setLineageConfig(config);
      setDialogVisible(false);
    },
    [setLineageConfig]
  );

  const isAiMode = useIsAiMode();

  // The header names what the map is focused on, which moves with breadcrumb
  // and lens changes while the URL path keeps the entity the page opened on.
  const searchPlaceholder = useMemo(() => {
    if (focusFqn && focusFqn !== decodedFqn) {
      return getNameFromFQN(focusFqn);
    }

    return selectedEntity
      ? getEntityName(selectedEntity)
      : t('label.search-entity-for-lineage', {
          entity: t('label.entity-lowercase'),
        });
  }, [focusFqn, decodedFqn, selectedEntity, t]);

  const searchSelect = useMemo(
    () => (
      <div
        className={isAiMode ? 'tw:w-90' : 'tw:w-1/2 tw:max-w-[500px]'}
        data-testid="search-entity-select">
        <DataAssetAsyncSelectList
          // eslint-disable-next-line jsx-a11y/no-autofocus -- disables the list's default autofocus
          autoFocus={false}
          // The current entity is the placeholder, not a chip: a single-select
          // chip hides the input, so the list could not open on first click.
          placeholder={searchPlaceholder}
          queryFilter={getLineageEntityExclusionFilter()}
          searchIndex={LINEAGE_SEARCH_INDEXES}
          onChange={handleSearchSelect}
        />
      </div>
    ),
    [isAiMode, searchPlaceholder, handleSearchSelect]
  );

  // Matches the height of the search box beside them in the AI header.
  const buttonSize = isAiMode ? 'xl' : 'lg';

  const actionButtons = useMemo(
    () => (
      <div className="d-flex gap-2">
        <LineageExportButton size={buttonSize} />

        <ButtonUtility
          data-testid="lineage-config"
          icon={Settings01}
          size={buttonSize}
          tooltip={t('label.lineage-config')}
          onClick={handleSettingsClick}
        />
      </div>
    ),
    [t, buttonSize]
  );

  const title = t('label.platform-type-lineage', {
    platformType: t(getLensLabelKey(lens)),
  });

  // AI mode moves the search and actions into the shared gradient header;
  // classic keeps them as the toolbar above the canvas.
  const header = useMemo(
    () =>
      isAiMode ? (
        <PageLayout.PageHeader
          actions={
            <>
              {searchSelect}
              {actionButtons}
            </>
          }
          badge={<LearningIcon pageId={LEARNING_PAGE_IDS.LINEAGE} />}
          data-testid="page-header-container"
          icon={
            <FeaturedIcon
              color="brand"
              icon={PlatformLineageIcon}
              shape="square"
              size="md"
              theme="dark"
            />
          }
          subtitle={t(PAGE_HEADERS.PLATFORM_LINEAGE.subHeader)}
          title={title}
          variant="gradient"
        />
      ) : (
        <div className="d-flex justify-between items-center">
          {searchSelect}
          {actionButtons}
        </div>
      ),
    [isAiMode, searchSelect, actionButtons, title, t]
  );

  const lineageElement = useMemo(() => {
    if (loading) {
      return <Loader />;
    }

    if (entityLoadError === 'denied') {
      return (
        <div className="tw:relative tw:min-h-80">
          <PermissionPlaceholder
            permissionValue={t('label.view-entity', {
              entity: t('label.lineage'),
            })}
          />
        </div>
      );
    }

    if (entityLoadError === 'failed') {
      return (
        <div className="tw:relative tw:min-h-80">
          <SomethingWentWrongPlaceholder onReload={init} />
        </div>
      );
    }

    if (entityLoadError === 'missing') {
      return (
        <div className="tw:relative tw:min-h-80">
          <NoDataPlaceholder
            title={t('message.no-entity-found-for-name', {
              entity: t('label.entity-lowercase'),
              name: decodedFqn,
            })}
          />
        </div>
      );
    }

    return (
      <Lineage
        isPlatformLineage
        entity={selectedEntity}
        entityFqn={decodedFqn}
        entityType={entityType}>
        <LineageComponent
          isPlatformLineage
          entity={selectedEntity}
          entityType={entityType}
          hasEditAccess={canEditLineage}
          // AI mode carries search and actions in the page header instead.
          platformHeader={isAiMode ? undefined : header}
        />
      </Lineage>
    );
  }, [
    selectedEntity,
    loading,
    entityLoadError,
    init,
    t,
    canEditLineage,
    entityType,
    header,
    decodedFqn,
    isAiMode,
  ]);

  // `/lineage` with no entity is the platform-wide view; the focused variant
  // names the entity it is centred on.
  const pageTitle = decodedFqn
    ? t('label.platform-type-lineage', {
        platformType: getEntityName(selectedEntity) || decodedFqn,
      })
    : t('label.lineage');

  const configModal = (
    <LineageConfigModal
      config={lineageConfig}
      visible={dialogVisible}
      onCancel={() => setDialogVisible(false)}
      onSave={handleDialogSave}
    />
  );

  if (isAiMode) {
    return (
      <PageLayout data-testid="platform-lineage-page">
        <DocumentTitle title={pageTitle} />
        {header}
        <PageLayout.Content className="tw:pt-4">
          <div className="platform-lineage-container platform-lineage-container-fill">
            {lineageElement}
          </div>
        </PageLayout.Content>
        {configModal}
      </PageLayout>
    );
  }

  return (
    <PageLayoutV1 pageTitle={pageTitle}>
      <Grid rowGap="2">
        <Grid.Item span={24}>
          <Card size="sm">
            <Card.Content>
              <PageHeader
                data={{
                  header: title,
                  subHeader: t(PAGE_HEADERS.PLATFORM_LINEAGE.subHeader),
                }}
                learningPageId={LEARNING_PAGE_IDS.LINEAGE}
                title={t('label.lineage')}
              />
            </Card.Content>
          </Card>
        </Grid.Item>

        <Grid.Item span={24}>
          <div className="platform-lineage-container">{lineageElement}</div>
        </Grid.Item>
      </Grid>

      {configModal}
    </PageLayoutV1>
  );
};

export default PlatformLineage;
