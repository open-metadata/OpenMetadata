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

import { XClose } from '@untitledui/icons';
import { Button, Card } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare, Operation as FastJsonPatchOperation } from 'fast-json-patch';
import { get, isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LineageData } from '../../../components/Lineage/Lineage.interface';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Operation } from '../../../generated/entity/policies/policy';
import { EntityReference, Type } from '../../../generated/entity/type';
import { PipelineViewMode } from '../../../generated/settings/settings';
import { TagLabel } from '../../../generated/tests/testCase';
import { EntityData } from '../../../pages/TasksPage/TasksPage.interface';
import {
  getApiCollectionByFQN,
  patchApiCollection,
} from '../../../rest/apiCollectionsAPI';
import {
  getApiEndPointByFQN,
  patchApiEndPoint,
} from '../../../rest/apiEndpointsAPI';
import { getChartByFqn, patchChartDetails } from '../../../rest/chartsAPI';
import {
  getDashboardByFqn,
  patchDashboardDetails,
} from '../../../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../../../rest/databaseAPI';
import {
  getDataModelByFqn,
  patchDataModelDetails,
} from '../../../rest/dataModelsAPI';
import {
  getDataProductByName,
  patchDataProduct,
} from '../../../rest/dataProductAPI';
import { getDomainByName, patchDomains } from '../../../rest/domainAPI';
import {
  getDriveAssetByFqn,
  patchDriveAssetDetails,
} from '../../../rest/driveAPI';
import {
  getGlossaryTermByFQN,
  patchGlossaryTerm,
} from '../../../rest/glossaryAPI';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { getMetricByFqn, patchMetric } from '../../../rest/metricsAPI';
import { getMlModelByFQN, patchMlModelDetails } from '../../../rest/mlModelAPI';
import {
  getPipelineByFqn,
  patchPipelineDetails,
} from '../../../rest/pipelineAPI';
import {
  getSearchIndexDetailsByFQN,
  patchSearchIndexDetails,
} from '../../../rest/SearchIndexAPI';
import {
  getContainerByFQN,
  patchContainerDetails,
} from '../../../rest/storageAPI';

import {
  getStoredProceduresByFqn,
  patchStoredProceduresDetails,
} from '../../../rest/storedProceduresAPI';
import {
  getTableDetailsByFQN,
  patchTableDetails,
  updateTableColumn,
} from '../../../rest/tableAPI';
import { getTopicByFqn, patchTopicDetails } from '../../../rest/topicsAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityLinkFromType,
} from '../../../utils/EntityUtils';
import {
  DEFAULT_ENTITY_PERMISSION,
  getPrioritizedEditPermission,
  getPrioritizedViewPermission,
} from '../../../utils/PermissionsUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import EntityDetailsSection from '../../common/EntityDetailsSection/EntityDetailsSection';
import { EntityTitleSection } from '../../common/EntityTitleSection/EntityTitleSection';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { DataAssetSummaryPanelV1 } from '../../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1';
import EntityRightPanelVerticalNav from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav.interface';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import CustomPropertiesSection from './CustomPropertiesSection';
import DataQualityTab from './DataQualityTab/DataQualityTab';
import './entity-summary-panel.less';
import {
  EntitySummaryPanelProps,
  SearchSourceDetails,
} from './EntitySummaryPanel.interface';
import { LineageTabContent } from './LineageTab';

export default function EntitySummaryPanel({
  entityDetails,
  handleClosePanel,
  highlights,
  isSideDrawer = false,
  panelPath,
  upstreamDepth,
  downstreamDepth,
  pipelineViewMode,
  nodesPerLayer,
  onEntityUpdate,
}: Readonly<EntitySummaryPanelProps>) {
  // Fallback when tests mock EntityUtils and omit DRAWER_NAVIGATION_OPTIONS
  const NAV_OPTIONS = DRAWER_NAVIGATION_OPTIONS || {
    explore: 'Explore',
    lineage: 'Lineage',
  };
  const { tab } = useRequiredParams<{ tab: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { getEntityPermission } = usePermissionProvider();
  const [isPermissionLoading, setIsPermissionLoading] = useState<boolean>(true);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [activeTab, setActiveTab] = useState<EntityRightPanelTab>(
    EntityRightPanelTab.OVERVIEW
  );
  const [entityData, setEntityData] = useState<EntityData | null>(null);
  const [entityTypeDetail, setEntityTypeDetail] = useState<Type | undefined>();
  const [isEntityDataLoading, setIsEntityDataLoading] = useState(false);
  const [isEntityTypeLoading, setIsEntityTypeLoading] = useState(false);
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [lineageFilter, setLineageFilter] = useState<'upstream' | 'downstream'>(
    'downstream'
  );

  const id = entityDetails?.details?.id ?? '';
  const fqn = entityDetails?.details?.fullyQualifiedName ?? '';

  const entityType = useMemo(
    () => get(entityDetails, 'details.entityType') as EntityType | undefined,
    [entityDetails]
  );

  const fetchResourcePermission = async (id: string) => {
    try {
      setIsPermissionLoading(true);
      let type = get(entityDetails, 'details.entityType');
      let idForPermission = id;

      // For tableColumn entities, use the parent table's resource type and ID
      // since columns inherit permissions from their parent table
      if (type === ResourceEntity.TABLE_COLUMN) {
        type = ResourceEntity.TABLE;
        // Get the parent table ID from the column's table reference
        const tableId = get(entityDetails, 'details.table.id') as string;
        if (tableId) {
          idForPermission = tableId;
        }
      }

      const permissions = await getEntityPermission(type, idForPermission);
      setEntityPermissions(permissions);
    } catch {
      // Error - set default permission to allow viewing
      // This prevents permission errors for entities like columns
      setEntityPermissions(DEFAULT_ENTITY_PERMISSION);
    } finally {
      setIsPermissionLoading(false);
    }
  };
  // Memoize the entity fetch map to avoid recreating it on every render
  const entityFetchMap = useMemo<
    Record<string, (fqn: string) => Promise<object>>
  >(() => {
    const commonFields = 'owners,domains,tags,extension';
    const domainFields = 'owners,tags,extension';

    return {
      [EntityType.TABLE]: (fqn) =>
        getTableDetailsByFQN(fqn, { fields: commonFields }),
      [EntityType.TOPIC]: (fqn) => getTopicByFqn(fqn, { fields: commonFields }),
      [EntityType.DASHBOARD]: (fqn) =>
        getDashboardByFqn(fqn, { fields: commonFields }),
      [EntityType.PIPELINE]: (fqn) =>
        getPipelineByFqn(fqn, { fields: commonFields }),
      [EntityType.MLMODEL]: (fqn) =>
        getMlModelByFQN(fqn, { fields: commonFields }),
      [EntityType.DATABASE]: (fqn) =>
        getDatabaseDetailsByFQN(fqn, { fields: commonFields }),
      [EntityType.DATABASE_SCHEMA]: (fqn) =>
        getDatabaseSchemaDetailsByFQN(fqn, { fields: commonFields }),
      [EntityType.DASHBOARD_DATA_MODEL]: (fqn) =>
        getDataModelByFqn(fqn, { fields: commonFields }),
      [EntityType.SEARCH_INDEX]: (fqn) =>
        getSearchIndexDetailsByFQN(fqn, { fields: commonFields }),
      [EntityType.STORED_PROCEDURE]: (fqn) =>
        getStoredProceduresByFqn(fqn, { fields: commonFields }),
      [EntityType.CONTAINER]: (fqn) =>
        getContainerByFQN(fqn, { fields: commonFields }),
      [EntityType.GLOSSARY_TERM]: (fqn) =>
        getGlossaryTermByFQN(fqn, { fields: commonFields }),
      [EntityType.CHART]: (fqn) => getChartByFqn(fqn, { fields: commonFields }),
      [EntityType.METRIC]: (fqn) =>
        getMetricByFqn(fqn, { fields: commonFields }),
      [EntityType.API_ENDPOINT]: (fqn) =>
        getApiEndPointByFQN(fqn, { fields: commonFields }),
      [EntityType.API_COLLECTION]: (fqn) =>
        getApiCollectionByFQN(fqn, { fields: commonFields }),
      [EntityType.DIRECTORY]: (fqn) =>
        getDriveAssetByFqn(fqn, EntityType.DIRECTORY, commonFields),
      [EntityType.FILE]: (fqn) =>
        getDriveAssetByFqn(fqn, EntityType.FILE, commonFields),
      [EntityType.SPREADSHEET]: (fqn) =>
        getDriveAssetByFqn(fqn, EntityType.SPREADSHEET, commonFields),
      [EntityType.WORKSHEET]: (fqn) =>
        getDriveAssetByFqn(fqn, EntityType.WORKSHEET, commonFields),
      [EntityType.DATA_PRODUCT]: (fqn) =>
        getDataProductByName(fqn, { fields: commonFields }),
      [EntityType.DOMAIN]: (fqn) =>
        getDomainByName(fqn, { fields: domainFields }),
    };
  }, []);

  const entityUpdateMap = useMemo<
    Record<
      string,
      (id: string, data: FastJsonPatchOperation[]) => Promise<object>
    >
  >(() => {
    return {
      [EntityType.TABLE]: (id, data) => patchTableDetails(id, data),
      [EntityType.TOPIC]: (id, data) => patchTopicDetails(id, data),
      [EntityType.DASHBOARD]: (id, data) => patchDashboardDetails(id, data),
      [EntityType.PIPELINE]: (id, data) => patchPipelineDetails(id, data),
      [EntityType.MLMODEL]: (id, data) => patchMlModelDetails(id, data),
      [EntityType.DATABASE]: (id, data) => patchDatabaseDetails(id, data),
      [EntityType.DATABASE_SCHEMA]: (id, data) =>
        patchDatabaseSchemaDetails(id, data),
      [EntityType.DASHBOARD_DATA_MODEL]: (id, data) =>
        patchDataModelDetails(id, data),
      [EntityType.SEARCH_INDEX]: (id, data) =>
        patchSearchIndexDetails(id, data),
      [EntityType.STORED_PROCEDURE]: (id, data) =>
        patchStoredProceduresDetails(id, data),
      [EntityType.CONTAINER]: (id, data) => patchContainerDetails(id, data),
      [EntityType.GLOSSARY_TERM]: (id, data) => patchGlossaryTerm(id, data),
      [EntityType.CHART]: (id, data) => patchChartDetails(id, data),
      [EntityType.METRIC]: (id, data) => patchMetric(id, data),
      [EntityType.API_ENDPOINT]: (id, data) => patchApiEndPoint(id, data),
      [EntityType.API_COLLECTION]: (id, data) => patchApiCollection(id, data),
      [EntityType.DIRECTORY]: (id, data) =>
        patchDriveAssetDetails(id, data, EntityType.DIRECTORY),
      [EntityType.FILE]: (id, data) =>
        patchDriveAssetDetails(id, data, EntityType.FILE),
      [EntityType.SPREADSHEET]: (id, data) =>
        patchDriveAssetDetails(id, data, EntityType.SPREADSHEET),
      [EntityType.WORKSHEET]: (id, data) =>
        patchDriveAssetDetails(id, data, EntityType.WORKSHEET),
      [EntityType.DATA_PRODUCT]: (id, data) => patchDataProduct(id, data),
      [EntityType.DOMAIN]: (id, data) => patchDomains(id, data),
    };
  }, []);

  const fetchEntityData = useCallback(async () => {
    if (!entityDetails?.details?.fullyQualifiedName || !entityType) {
      return;
    }

    setIsEntityDataLoading(true);
    try {
      const fqn = entityDetails.details.fullyQualifiedName;
      let entityPromise: Promise<object> | null = null;

      const fetchFn = entityFetchMap[entityType];
      if (fetchFn) {
        entityPromise = fetchFn(fqn);
      } else if (entityType === EntityType.KNOWLEDGE_PAGE) {
        entityPromise = entityUtilClassBase.getEntityByFqn(
          entityType,
          fqn,
          'owners,domains,tags'
        );
      } else {
        entityPromise = entityUtilClassBase.getEntityByFqn(
          entityType,
          fqn,
          'owners,domains,tags,extension'
        );
      }

      if (entityPromise) {
        const data = (await entityPromise) as {
          description?: string;
          displayName?: string;
          service?: EntityReference;
          owners?: EntityReference[];
          domains?: EntityReference[];
          tags?: TagLabel[];
          dataProducts?: EntityReference[];
        };
        const searchDetails: SearchSourceDetails = entityDetails.details;
        // Merge API data with essential fields from entityDetails.details
        const mergedData = {
          ...data,
          // Essential fields that are used in DataAssetSummaryPanelV1
          entityType: entityDetails.details.entityType,
          fullyQualifiedName: entityDetails.details.fullyQualifiedName,
          id: entityDetails.details.id ?? '',
          description: data.description ?? entityDetails.details.description,
          displayName: data.displayName,
          name: entityDetails.details.name,
          deleted: entityDetails.details.deleted,
          serviceType: searchDetails.serviceType,
          service: data.service ?? entityDetails.details.service,
          // Prefer canonical data; fallback to search result if missing
          owners: data.owners ?? [],
          domains: data.domains ?? [],
          tags: data.tags ?? [],
          dataProducts: data.dataProducts ?? searchDetails.dataProducts,
          tier: searchDetails.tier,
          columnNames: searchDetails.columnNames,
          database: searchDetails.database,
          databaseSchema: searchDetails.databaseSchema,
          tableType: searchDetails.tableType,
        };
        setEntityData(mergedData as EntityData);
      } else {
        // For entity types without a dedicated API (like tableColumn),
        // use the search index data directly. The search index already
        // contains all necessary fields (service, database, schema, table, etc.)
        const searchData = entityDetails.details as EntityData;
        setEntityData(searchData);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEntityDataLoading(false);
    }
  }, [entityDetails?.details?.fullyQualifiedName, entityType, entityFetchMap]);

  const fetchEntityTypeDetail = useCallback(async () => {
    if (!entityType || entityType === EntityType.KNOWLEDGE_PAGE) {
      return;
    }

    setIsEntityTypeLoading(true);
    try {
      const typeDetail = await getTypeByFQN(entityType);
      setEntityTypeDetail(typeDetail);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEntityTypeLoading(false);
    }
  }, [entityType]);

  const fetchLineageData = useCallback(async () => {
    const currentFqn = entityDetails?.details?.fullyQualifiedName;

    if (!currentFqn || !entityType) {
      setIsLineageLoading(false);
      setLineageData(null);

      return;
    }

    try {
      setIsLineageLoading(true);

      const response = await getLineageDataByFQN({
        fqn: currentFqn,
        entityType,
        config: {
          upstreamDepth: upstreamDepth ?? 1,
          downstreamDepth: downstreamDepth ?? 1,
          nodesPerLayer: nodesPerLayer ?? 50,
          pipelineViewMode: pipelineViewMode ?? PipelineViewMode.Node,
        },
      });

      if (entityDetails?.details?.fullyQualifiedName !== currentFqn) {
        return;
      }

      setLineageData(response);
    } catch (error) {
      if (entityDetails?.details?.fullyQualifiedName === currentFqn) {
        showErrorToast(error as AxiosError);
        setLineageData(null);
      }
    } finally {
      if (entityDetails?.details?.fullyQualifiedName === currentFqn) {
        setIsLineageLoading(false);
      }
    }
  }, [
    entityDetails?.details?.fullyQualifiedName,
    entityType,
    upstreamDepth,
    downstreamDepth,
    nodesPerLayer,
    pipelineViewMode,
  ]);

  const updateEntityData = useCallback(
    (updatedData: Partial<EntityData>) => {
      if (onEntityUpdate) {
        onEntityUpdate(updatedData);
      } else {
        setEntityData(
          (prev) =>
            ({
              ...(prev ?? entityDetails.details),
              ...updatedData,
            } as EntityData)
        );
      }
    },
    [entityDetails.details, onEntityUpdate]
  );

  const handleOwnerUpdate = useCallback(
    (owners: EntityReference[]) => {
      updateEntityData({ owners });
    },
    [updateEntityData]
  );

  const handleDomainUpdate = useCallback(
    (domains: EntityReference[]) => {
      updateEntityData({ domains });
    },
    [updateEntityData]
  );

  const handleTagsUpdate = useCallback(
    async (updatedTags: TagLabel[]) => {
      if (onEntityUpdate) {
        onEntityUpdate({ tags: updatedTags });

        return updatedTags;
      }

      const baseData = entityData ?? entityDetails.details;
      const jsonPatch = compare(baseData, {
        ...baseData,
        tags: updatedTags,
      });

      if (isEmpty(jsonPatch)) {
        return updatedTags;
      }

      if (!entityType) {
        return;
      }

      try {
        let res: Partial<EntityData> = {};
        if (entityType === EntityType.TABLE_COLUMN) {
          res = await updateTableColumn(fqn, {
            tags: updatedTags,
          });
        } else {
          const apiFunc = entityUpdateMap[entityType];
          if (apiFunc && id) {
            res = await apiFunc(id, jsonPatch);
          }
        }
        setEntityData(
          (prev) =>
            ({
              ...(prev || entityDetails.details),
              ...res,
            } as EntityData)
        );

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.tag-plural'),
          })
        );

        return res.tags;
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      }
    },
    [
      onEntityUpdate,
      entityData,
      entityDetails.details,
      entityType,
      id,
      entityUpdateMap,
      t,
      fqn,
    ]
  );

  const handleTierUpdate = useCallback(
    (updatedTier?: TagLabel) => {
      const currentTags = entityData?.tags ?? [];
      const tagsWithoutTier = currentTags.filter(
        (tag: TagLabel) => !tag.tagFQN?.startsWith('Tier.')
      );
      const newTags = updatedTier
        ? [...tagsWithoutTier, updatedTier]
        : tagsWithoutTier;
      updateEntityData({ tags: newTags });
    },
    [entityData, updateEntityData]
  );

  const handleDataProductsUpdate = useCallback(
    (updatedDataProducts: EntityReference[]) => {
      updateEntityData({ dataProducts: updatedDataProducts });
    },
    [updateEntityData]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedTags: TagLabel[]) => {
      if (onEntityUpdate) {
        onEntityUpdate({ tags: updatedTags });

        return updatedTags;
      }

      const baseData = entityData ?? entityDetails.details;
      const jsonPatch = compare(baseData, {
        ...baseData,
        tags: updatedTags,
      });

      if (isEmpty(jsonPatch)) {
        return updatedTags;
      }

      if (!entityType) {
        return;
      }

      try {
        let res: Partial<EntityData> = {};
        if (entityType === EntityType.TABLE_COLUMN) {
          res = await updateTableColumn(fqn, {
            tags: updatedTags,
          });
        } else {
          const apiFunc = entityUpdateMap[entityType];
          if (apiFunc && id) {
            res = await apiFunc(id, jsonPatch);
          }
        }
        setEntityData(
          (prev) =>
            ({
              ...(prev || entityDetails.details),
              ...res,
            } as EntityData)
        );

        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.glossary-term-plural'),
          })
        );

        return res.tags;
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      }
    },
    [
      onEntityUpdate,
      entityData,
      entityDetails.details,
      entityType,
      id,
      entityUpdateMap,
      t,
      fqn,
    ]
  );

  const handleDescriptionUpdate = useCallback(
    (updatedDescription: string) => {
      updateEntityData({ description: updatedDescription });
    },
    [updateEntityData]
  );

  const handleDisplayNameUpdate = useCallback(
    (updatedDisplayName: string) => {
      updateEntityData({ displayName: updatedDisplayName });
    },
    [entityData, updateEntityData]
  );

  const handleExtensionUpdate = useCallback(
    async (updatedExtension: Record<string, unknown> | undefined) => {
      if (onEntityUpdate) {
        onEntityUpdate({ extension: updatedExtension });
      } else {
        try {
          let res: Partial<EntityData> = {};
          // TableColumn entity has a different API endpoint for updating extension field, so handle it separately
          if (entityType === EntityType.TABLE_COLUMN) {
            res = await updateTableColumn(fqn, {
              extension: {
                ...(Object.fromEntries(
                  Object.entries(updatedExtension || {}).map(([key, value]) => [
                    key,
                    value ?? null,
                  ])
                ) as Record<string, unknown>),
              },
            });
          } else {
            const baseData = entityData ?? entityDetails.details;
            const jsonPatch = compare(baseData, {
              ...baseData,
              extension: updatedExtension,
            });

            if (isEmpty(jsonPatch)) {
              return;
            }

            const apiFunc = entityUpdateMap[entityType];
            if (apiFunc && id) {
              res = await apiFunc(id, jsonPatch);
            }
          }
          setEntityData(
            (prev) =>
              ({
                ...(prev || entityDetails.details),
                ...res,
              } as EntityData)
          );
        } catch (error) {
          showErrorToast(error as AxiosError);

          throw error;
        }
      }
    },
    [
      entityDetails.details,
      onEntityUpdate,
      entityType,
      id,
      entityUpdateMap,
      entityData,
      fqn,
    ]
  );

  const handleLineageClick = useCallback(() => {
    const fqn = entityDetails?.details?.fullyQualifiedName;
    const type = entityDetails?.details?.entityType as EntityType;

    if (fqn && type) {
      const lineageUrl = getEntityDetailsPath(type, fqn, EntityTabs.LINEAGE);
      navigate(lineageUrl);
    }
  }, [entityDetails, navigate]);

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  // Reset activeTab to OVERVIEW when entity changes
  useEffect(() => {
    setActiveTab(EntityRightPanelTab.OVERVIEW);
  }, [entityDetails?.details?.id]);

  // Reset data when entity changes to prevent stale data
  useEffect(() => {
    setEntityData(null);
    setLineageData(null);
    setIsLineageLoading(false);
  }, [entityDetails?.details?.id]);

  useEffect(() => {
    if (activeTab === EntityRightPanelTab.CUSTOM_PROPERTIES) {
      fetchEntityData();
      fetchEntityTypeDetail();
    } else if (activeTab === EntityRightPanelTab.LINEAGE) {
      fetchLineageData();
    } else if (activeTab === EntityRightPanelTab.OVERVIEW) {
      fetchEntityData();
    }
  }, [
    activeTab,
    entityType,
    entityDetails?.details?.fullyQualifiedName,
    fetchEntityData,
    fetchEntityTypeDetail,
    fetchLineageData,
  ]);

  const viewPermission = useMemo(
    () => entityPermissions.ViewBasic || entityPermissions.ViewAll,
    [entityPermissions]
  );

  const summaryComponentV1 = useMemo(() => {
    if (isPermissionLoading) {
      return <Loader />;
    }
    if (!viewPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none h-min-80"
          permissionValue={t('label.view-entity', {
            entity: t('label.data-asset'),
          })}
          size={SIZE.MEDIUM}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }
    const type = (get(entityDetails, 'details.entityType') ??
      EntityType.TABLE) as EntityType;
    const entity = entityData || entityDetails.details;

    return (
      <DataAssetSummaryPanelV1
        componentType={tab === NAV_OPTIONS.lineage ? tab : NAV_OPTIONS.explore}
        dataAsset={
          entity as SearchedDataProps['data'][number]['_source'] & {
            dataProducts: DataProduct[];
          }
        }
        entityType={type}
        highlights={highlights}
        panelPath={panelPath}
        onDataProductsUpdate={handleDataProductsUpdate}
        onDescriptionUpdate={handleDescriptionUpdate}
        onDomainUpdate={handleDomainUpdate}
        onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
        onLineageClick={handleLineageClick}
        onLinkClick={handleClosePanel}
        onOwnerUpdate={handleOwnerUpdate}
        onTagsUpdate={handleTagsUpdate}
        onTierUpdate={handleTierUpdate}
      />
    );
  }, [
    tab,
    entityDetails,
    entityData,
    viewPermission,
    isPermissionLoading,
    handleOwnerUpdate,
    handleDomainUpdate,
    handleTagsUpdate,
    handleTierUpdate,
    handleDataProductsUpdate,
    handleDescriptionUpdate,
    handleGlossaryTermsUpdate,
    handleLineageClick,
  ]);
  const entityLink = useMemo(
    () => searchClassBase.getEntityLink(entityDetails.details),
    [entityDetails, getEntityLinkFromType]
  );

  const handleTabChange = (tab: EntityRightPanelTab) => {
    setActiveTab(tab);
  };

  const renderLineageContent = () => {
    if (isLineageLoading) {
      return (
        <div className="flex-center p-lg">
          <Loader size="default" />
        </div>
      );
    }

    if (lineageData) {
      return (
        <LineageTabContent
          entityFqn={entityDetails?.details?.fullyQualifiedName || ''}
          filter={lineageFilter}
          lineageData={lineageData}
          onFilterChange={setLineageFilter}
        />
      );
    }

    return (
      <div className="text-center text-grey-muted p-lg">
        {t('label.no-data-found')}
      </div>
    );
  };

  const renderTabContent = () => {
    if (isPermissionLoading) {
      return <Loader />;
    }

    if (!viewPermission) {
      return (
        <>
          {!isSideDrawer && (
            <EntityTitleSection
              className="title-section"
              entityDetails={entityDetails.details}
              entityDisplayName={entityData?.displayName}
              entityLink={entityLink}
              entityType={entityType}
              hasEditPermission={getPrioritizedEditPermission(
                entityPermissions,
                Operation.EditDisplayName
              )}
              onDisplayNameUpdate={handleDisplayNameUpdate}
            />
          )}
          <ErrorPlaceHolder
            className="border-none h-min-80"
            permissionValue={t('label.view-entity', {
              entity: t('label.data-asset'),
            })}
            size={SIZE.MEDIUM}
            type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
          />
        </>
      );
    }
    switch (activeTab) {
      case EntityRightPanelTab.OVERVIEW:
        return (
          <>
            {!isSideDrawer && (
              <EntityTitleSection
                className="title-section"
                entityDetails={entityDetails.details}
                entityDisplayName={entityData?.displayName}
                entityLink={entityLink}
                entityType={entityType}
                hasEditPermission={getPrioritizedEditPermission(
                  entityPermissions,
                  Operation.EditDisplayName
                )}
                onDisplayNameUpdate={handleDisplayNameUpdate}
              />
            )}

            <div className="overview-tab-content">{summaryComponentV1}</div>
          </>
        );
      case EntityRightPanelTab.SCHEMA:
        return (
          <>
            {!isSideDrawer && (
              <EntityTitleSection
                className="title-section"
                entityDetails={entityDetails.details}
                entityLink={entityLink}
              />
            )}
            <div className="entity-summary-panel-tab-content">
              {entityType && (
                <EntityDetailsSection
                  dataAsset={entityDetails.details}
                  entityType={entityType}
                  highlights={highlights}
                  isLoading={isPermissionLoading}
                />
              )}
            </div>
          </>
        );
      case EntityRightPanelTab.LINEAGE:
        return (
          <>
            {!isSideDrawer && (
              <EntityTitleSection
                className="title-section"
                entityDetails={entityDetails.details}
                entityLink={entityLink}
                entityType={entityType}
                hasEditPermission={getPrioritizedEditPermission(
                  entityPermissions,
                  Operation.EditDisplayName
                )}
                onDisplayNameUpdate={handleDisplayNameUpdate}
              />
            )}
            <div className="entity-summary-panel-tab-content">
              <div className="p-x-md">{renderLineageContent()}</div>
            </div>
          </>
        );
      case EntityRightPanelTab.DATA_QUALITY:
        return (
          <>
            {!isSideDrawer && (
              <EntityTitleSection
                className="title-section"
                entityDetails={entityDetails.details}
                entityLink={entityLink}
              />
            )}
            <DataQualityTab
              entityFQN={entityDetails.details.fullyQualifiedName || ''}
              hasViewTests={
                entityPermissions.ViewTests || entityPermissions.ViewAll
              }
            />
          </>
        );
      case EntityRightPanelTab.CUSTOM_PROPERTIES: {
        return (
          <>
            {!isSideDrawer && (
              <EntityTitleSection
                className="title-section"
                entityDetails={entityDetails.details}
                entityLink={entityLink}
              />
            )}
            {entityType && (
              <CustomPropertiesSection
                emptyStateMessage={entityUtilClassBase.getFormattedEntityType(
                  entityType
                )}
                entityData={entityData ?? undefined}
                entityDetails={entityDetails}
                entityType={entityType}
                entityTypeDetail={entityTypeDetail}
                hasEditPermissions={getPrioritizedEditPermission(
                  entityPermissions,
                  Operation.EditCustomFields
                )}
                isEntityDataLoading={isEntityDataLoading || isEntityTypeLoading}
                viewCustomPropertiesPermission={getPrioritizedViewPermission(
                  entityPermissions,
                  Operation.ViewCustomFields
                )}
                onExtensionUpdate={handleExtensionUpdate}
              />
            )}
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div
      className={classNames('entity-summary-panel-container', {
        explore: panelPath === 'explore',
        lineage: panelPath === 'lineage',
        'glossary-term-assets-tab': panelPath === 'glossary-term-assets-tab',
      })}
      data-testid="entity-summary-panel-container">
      {isSideDrawer && (
        <div className="d-flex items-center justify-between">
          <EntityTitleSection
            className="tw:bg-transparent!"
            entityDetails={entityDetails.details}
            entityDisplayName={entityData?.displayName}
            entityLink={entityLink}
            entityType={entityType}
            hasEditPermission={getPrioritizedEditPermission(
              entityPermissions,
              Operation.EditDisplayName
            )}
            testId="entity-header-title"
            tooltipPlacement="bottom left"
            onDisplayNameUpdate={handleDisplayNameUpdate}
          />
          <Button
            aria-label={t('label.close')}
            className="drawer-close-icon flex-center mr-2"
            data-testid="drawer-close-icon"
            icon={<XClose />}
            size="small"
            onClick={handleClosePanel}
          />
        </div>
      )}
      <div className="d-flex gap-2 w-full h-full">
        <Card
          bordered={false}
          className={`summary-panel-container ${
            isSideDrawer ? 'drawer-summary-panel-container' : ''
          }`}>
          <Card
            className={`content-area ${
              isSideDrawer ? 'drawer-content-area' : ''
            }`}
            style={{ width: '100%', display: 'block' }}>
            {renderTabContent()}
          </Card>
        </Card>
        {entityType && (
          <EntityRightPanelVerticalNav
            activeTab={activeTab}
            entityType={entityType}
            isSideDrawer={isSideDrawer}
            onTabChange={handleTabChange}
          />
        )}
      </div>
    </div>
  );
}
