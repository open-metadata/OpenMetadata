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
  Home02,
  PlatformLineage as PlatformLineageIcon,
  Settings01,
} from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import NoDataPlaceholder from '../../components/common/EmptyPlaceholder/NoDataPlaceholder';
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
import { ROUTES } from '../../constants/constants';
import { LEARNING_PAGE_IDS } from '../../constants/Learning.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { EntityType } from '../../enums/entity.enum';
import { ResourceEntity } from '../../enums/permissions.enum';
import { SearchIndex } from '../../enums/search.enum';
import { LineageLens } from '../../generated/api/lineage/lineageScene';
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
import { getEncodedFqn } from '../../utils/StringUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import './platform-lineage.less';

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
  const [isEntityNotFound, setIsEntityNotFound] = useState(false);
  const [isEntityLoading, setIsEntityLoading] = useState(false);
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
    // An entity that does not exist gets its own empty state below, so its
    // permission lookup's "not found" is not toasted on top of it.
    if (
      permissionsError &&
      (permissionsError as AxiosError).response?.status !== 404
    ) {
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
  const { lens } = getSceneRequestFromSearch(location.search, {}, true);

  const handleEntitySelect = useCallback(
    (value: EntityReference) => {
      const { entityType: selectedType } = value as SourceType;
      // A domain is drawn by the Domain lens; the Service lens has no scene
      // for it and would focus one of its assets instead.
      const search =
        selectedType === EntityType.DOMAIN
          ? `?lineageLens=${LineageLens.Domain}`
          : '';
      void navigate(
        `/lineage/${selectedType}/${getEncodedFqn(
          value.fullyQualifiedName ?? ''
        )}${search}`
      );
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
    setIsEntityNotFound(false);
    if (!decodedFqn || !entityType) {
      setSelectedEntity(undefined);

      return;
    }

    try {
      setIsEntityLoading(true);
      const entityResponse = await getEntityAPIfromSource(
        entityType as AssetsUnion
      )(decodedFqn);
      setSelectedEntity(entityResponse);
    } catch (error) {
      // Old code awaited this via Promise.allSettled alongside the permission fetch, so a
      // rejection (or a synchronous throw from an unsupported entityType) never reached a
      // showErrorToast call. Preserve that silently; permission-fetch errors surface
      // separately via the hook's own effect above. The previous entity is dropped
      // so its map and title do not stay on screen for the new URL.
      setSelectedEntity(undefined);
      setIsEntityNotFound((error as AxiosError)?.response?.status === 404);
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
          placeholder={
            selectedEntity
              ? getEntityName(selectedEntity)
              : t('label.search-entity-for-lineage', {
                  entity: t('label.entity-lowercase'),
                })
          }
          queryFilter={getLineageEntityExclusionFilter()}
          searchIndex={LINEAGE_SEARCH_INDEXES}
          onChange={handleSearchSelect}
        />
      </div>
    ),
    [isAiMode, selectedEntity, handleSearchSelect, t]
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

    if (isEntityNotFound) {
      return (
        <Card className="lineage-card tw:flex tw:flex-col">
          {isAiMode ? null : (
            <div className="tw:shrink-0 tw:border-b tw:border-tertiary tw:px-6 tw:py-4">
              {header}
            </div>
          )}
          <div
            className="tw:relative tw:min-h-80 tw:flex-1"
            data-testid="lineage-entity-not-found">
            <NoDataPlaceholder
              actions={[
                {
                  key: 'back-to-root',
                  label: t('label.back-to-entity', {
                    entity: t('label.all-service-plural'),
                  }),
                  color: 'secondary',
                  iconLeading: Home02,
                  onPress: () => navigate(ROUTES.PLATFORM_LINEAGE),
                },
              ]}
              icon={<PlatformLineageIcon />}
              title={t('message.no-entity-found-for-name', {
                entity: t('label.asset-lowercase'),
                name: decodedFqn,
              })}
            />
          </div>
        </Card>
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
    isEntityNotFound,
    canEditLineage,
    entityType,
    header,
    decodedFqn,
    isAiMode,
    navigate,
    t,
  ]);

  // `/lineage` with no entity is the platform-wide view; the focused variant
  // names the entity it is centred on.
  const pageTitle =
    decodedFqn && !isEntityNotFound
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
