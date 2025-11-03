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

import { Link } from '@mui/material';
import { Card, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { get } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LineageData } from '../../../components/Lineage/Lineage.interface';
import { usePermissionProvider } from '../../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { EntityReference } from '../../../generated/entity/type';
import { TagSource } from '../../../generated/type/tagLabel';
import { getSearchIndexDetailsByFQN } from '../../../rest/SearchIndexAPI';
import { getDashboardByFqn } from '../../../rest/dashboardAPI';
import { getDataModelByFqn } from '../../../rest/dataModelsAPI';
import { getDatabaseDetailsByFQN } from '../../../rest/databaseAPI';
import { getLineageDataByFQN } from '../../../rest/lineageAPI';
import { getTypeByFQN } from '../../../rest/metadataTypeAPI';
import { getMlModelByFQN } from '../../../rest/mlModelAPI';
import { getPipelineByFqn } from '../../../rest/pipelineAPI';
import { getStoredProceduresByFqn } from '../../../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../../../rest/tableAPI';
import { getTopicByFqn } from '../../../rest/topicsAPI';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityLinkFromType,
  getEntityName,
} from '../../../utils/EntityUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { stringToHTML } from '../../../utils/StringsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { DataAssetSummaryPanel } from '../../DataAssetSummaryPanel/DataAssetSummaryPanel';
import { DataAssetSummaryPanelV1 } from '../../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1';
import EntityRightPanelVerticalNav from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from '../../Entity/EntityRightPanel/EntityRightPanelVerticalNav.interface';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import EntityDetailsSection from '../../common/EntityDetailsSection/EntityDetailsSection';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import CustomPropertiesSection from './CustomPropertiesSection';
import DataQualityTab from './DataQualityTab/DataQualityTab';
import { EntitySummaryPanelProps } from './EntitySummaryPanel.interface';
import { LineageTabContent } from './LineageTab';
import './entity-summary-panel.less';

export default function EntitySummaryPanel({
  entityDetails,
  highlights,
}: EntitySummaryPanelProps) {
  // Fallback when tests mock EntityUtils and omit DRAWER_NAVIGATION_OPTIONS
  const NAV_OPTIONS = (DRAWER_NAVIGATION_OPTIONS as any) || {
    explore: 'Explore',
    lineage: 'Lineage',
  };
  const { tab } = useRequiredParams<{ tab: string }>();
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();
  const [isPermissionLoading, setIsPermissionLoading] =
    useState<boolean>(false);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [activeTab, setActiveTab] = useState<EntityRightPanelTab>(
    EntityRightPanelTab.OVERVIEW
  );
  const [entityData, setEntityData] = useState<any>(null);
  const [entityTypeDetail, setEntityTypeDetail] = useState<any>(null);
  const [isEntityDataLoading, setIsEntityDataLoading] = useState(false);
  const [lineageData, setLineageData] = useState<LineageData | null>(null);
  const [isLineageLoading, setIsLineageLoading] = useState<boolean>(false);
  const [lineageFilter, setLineageFilter] = useState<'upstream' | 'downstream'>(
    'downstream'
  );

  const id = useMemo(() => {
    setIsPermissionLoading(true);

    return entityDetails?.details?.id ?? '';
  }, [entityDetails?.details?.id]);

  const entityType = useMemo(() => {
    return get(entityDetails, 'details.entityType') as EntityType;
  }, [entityDetails]);

  const fetchResourcePermission = async (entityFqn: string) => {
    try {
      setIsPermissionLoading(true);
      const type = (get(entityDetails, 'details.entityType') ??
        ResourceEntity.TABLE) as ResourceEntity;
      const permissions = await getEntityPermission(type, entityFqn);
      setEntityPermissions(permissions);
    } catch {
      // Error
    } finally {
      setIsPermissionLoading(false);
    }
  };
  const fetchEntityData = useCallback(async () => {
    if (!entityDetails?.details?.fullyQualifiedName || !entityType) {
      return;
    }

    setIsEntityDataLoading(true);
    try {
      const fqn = entityDetails.details.fullyQualifiedName;
      let entityPromise: Promise<any> | null = null;

      // Fields needed for the right panel to reflect latest state
      const commonFields =
        'owners,domains,tags,dataProducts,description,extension';

      switch (entityType) {
        case EntityType.TABLE:
          entityPromise = getTableDetailsByFQN(fqn, {
            fields: commonFields,
          });

          break;

        case EntityType.TOPIC:
          entityPromise = getTopicByFqn(fqn, { fields: commonFields });

          break;

        case EntityType.DASHBOARD:
          entityPromise = getDashboardByFqn(fqn, { fields: commonFields });

          break;

        case EntityType.PIPELINE:
          entityPromise = getPipelineByFqn(fqn, { fields: commonFields });

          break;

        case EntityType.MLMODEL:
          entityPromise = getMlModelByFQN(fqn, { fields: commonFields });

          break;

        case EntityType.DATABASE:
          entityPromise = getDatabaseDetailsByFQN(fqn, {
            fields: commonFields,
          });

          break;

        case EntityType.DASHBOARD_DATA_MODEL:
          entityPromise = getDataModelByFqn(fqn, { fields: commonFields });

          break;

        case EntityType.SEARCH_INDEX:
          entityPromise = getSearchIndexDetailsByFQN(fqn);

          break;

        case EntityType.STORED_PROCEDURE:
          entityPromise = getStoredProceduresByFqn(fqn, {
            fields: commonFields,
          });

          break;

        default:
          break;
      }

      if (entityPromise) {
        const data = await entityPromise;
        // Merge API data with essential fields from entityDetails.details
        const mergedData = {
          ...data,
          // Essential fields that are used in DataAssetSummaryPanelV1
          entityType: entityDetails.details.entityType,
          fullyQualifiedName: entityDetails.details.fullyQualifiedName,
          id: entityDetails.details.id,
          description: data.description ?? entityDetails.details.description,
          displayName: entityDetails.details.displayName,
          name: entityDetails.details.name,
          deleted: entityDetails.details.deleted,
          serviceType: (entityDetails.details as any).serviceType,
          service: data.service ?? entityDetails.details.service,
          // Prefer canonical data; fallback to search result if missing
          owners: data.owners ?? entityDetails.details.owners,
          domains: data.domains ?? entityDetails.details.domains,
          tags: data.tags ?? entityDetails.details.tags,
          dataProducts:
            data.dataProducts ?? (entityDetails.details as any).dataProducts,
          tier: (entityDetails.details as any).tier,
          columnNames: (entityDetails.details as any).columnNames,
          database: (entityDetails.details as any).database,
          databaseSchema: (entityDetails.details as any).databaseSchema,
          tableType: (entityDetails.details as any).tableType,
        };
        setEntityData(mergedData);
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEntityDataLoading(false);
    }
  }, [entityDetails?.details?.fullyQualifiedName, entityType]);

  const fetchEntityTypeDetail = useCallback(async () => {
    if (!entityType) {
      return;
    }

    try {
      const typeDetail = await getTypeByFQN(entityType);
      setEntityTypeDetail(typeDetail);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, [entityType]);

  const fetchLineageData = useCallback(async () => {
    const fqn = entityDetails?.details?.fullyQualifiedName;
    if (!fqn || !entityType) {
      return;
    }

    try {
      setIsLineageLoading(true);
      const response = await getLineageDataByFQN({
        fqn,
        entityType,
        config: {
          upstreamDepth: 2,
          downstreamDepth: 1,
          nodesPerLayer: 50,
        },
      });
      setLineageData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setLineageData(null);
    } finally {
      setIsLineageLoading(false);
    }
  }, [entityDetails?.details?.fullyQualifiedName, entityType]);

  const handleOwnerUpdate = useCallback(
    (updatedOwners: EntityReference[]) => {
      const ownersClone = updatedOwners.map((o) => ({ ...o }));
      setEntityData((prevData: any) => {
        if (!prevData || prevData.id !== entityDetails.details.id) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          owners: ownersClone,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted === undefined
              ? entityDetails.details.deleted
              : prevData.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          domains: prevData.domains || entityDetails.details.domains,
          tags: prevData.tags || entityDetails.details.tags,
          tier: prevData.tier || (entityDetails.details as any).tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityDetails.details]
  );

  const handleDomainUpdate = useCallback(
    (updatedDomains: EntityReference[]) => {
      const domainsClone = updatedDomains.map((d) => ({ ...d }));
      setEntityData((prevData: any) => {
        if (!prevData || prevData.id !== entityDetails.details.id) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          domains: domainsClone,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted === undefined
              ? entityDetails.details.deleted
              : prevData.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          tags: prevData.tags || entityDetails.details.tags,
          tier: prevData.tier || (entityDetails.details as any).tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityDetails.details]
  );

  const handleTagsUpdate = useCallback(
    (updatedTags: any[]) => {
      setEntityData((prevData: any) => {
        if (!prevData || prevData.id !== entityDetails.details.id) {
          return prevData;
        }
        const currentTags = prevData.tags || [];
        const existingGlossaryTerms = currentTags.filter(
          (tag: any) => tag.source === TagSource.Glossary
        );

        // updatedTags already includes tier tags merged from TagsSection
        // Merge with existing glossary terms
        const mergedTags = [...existingGlossaryTerms, ...updatedTags];

        const updatedData = {
          ...prevData,
          tags: mergedTags,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted === undefined
              ? entityDetails.details.deleted
              : prevData.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          domains: prevData.domains || entityDetails.details.domains,
          tier: prevData.tier || (entityDetails.details as any).tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityDetails.details]
  );

  const handleTierUpdate = useCallback(
    (updatedTier?: any) => {
      setEntityData((prevData: any) => {
        if (!prevData || prevData.id !== entityDetails.details.id) {
          return prevData;
        }

        // Update the tags array by removing old tier and adding new one
        const tagsWithoutTier = (prevData.tags || []).filter(
          (tag: any) => !tag.tagFQN?.startsWith('Tier.')
        );

        const updatedTags = updatedTier
          ? [...tagsWithoutTier, updatedTier]
          : tagsWithoutTier;

        const updatedData = {
          ...prevData,
          tags: updatedTags,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted === undefined
              ? entityDetails.details.deleted
              : prevData.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          domains: prevData.domains || entityDetails.details.domains,
          tier: updatedTier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityDetails.details]
  );

  const handleDataProductsUpdate = useCallback(
    (updatedDataProducts: EntityReference[]) => {
      const dpsClone = updatedDataProducts.map((dp) => ({ ...dp }));
      setEntityData((prevData: any) => {
        if (!prevData || prevData.id !== entityDetails.details.id) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          dataProducts: dpsClone,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          description:
            prevData.description || entityDetails.details.description,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted === undefined
              ? entityDetails.details.deleted
              : prevData.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          domains: prevData.domains || entityDetails.details.domains,
          tags: prevData.tags || entityDetails.details.tags,
          tier: prevData.tier || (entityDetails.details as any).tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityDetails.details]
  );

  const handleGlossaryTermsUpdate = useCallback(
    async (updatedTags: any[]) => {
      try {
        // Use the most up-to-date entity data as the base
        const currentEntityData = entityData || entityDetails.details;

        // Get current tags and separate glossary terms from classification tags
        const currentTags = currentEntityData.tags || [];
        const classificationTags = currentTags.filter(
          (tag: any) => tag.source !== TagSource.Glossary
        );

        // Normalize the current tags to ensure they have all required properties
        const normalizedClassificationTags = classificationTags.map(
          (tag: any) => ({
            ...tag,
            style: tag.style || {},
          })
        );

        // Normalize the updated tags to ensure they have all required properties
        const normalizedUpdatedTags = updatedTags.map((tag: any) => ({
          ...tag,
          style: tag.style || {},
        }));

        // Merge classification tags with new glossary terms
        const mergedTags = [
          ...normalizedClassificationTags,
          ...normalizedUpdatedTags,
        ];

        // Create updated entity data with merged tags - following the same pattern as TableDetailsPageV1
        const updatedEntityData = {
          ...currentEntityData,
          tags: mergedTags,
        };

        // Normalize the current entity data to ensure all tags have required properties
        const normalizedCurrentEntityData = {
          ...currentEntityData,
          tags: currentTags.map((tag: any) => ({
            ...tag,
            style: tag.style || {},
          })),
        };

        // Generate JSON patch by comparing only the tags arrays to avoid array index issues
        const currentTagsNormalized = normalizedCurrentEntityData.tags || [];
        const updatedTagsArray = updatedEntityData.tags || [];

        // Check if tags have actually changed
        const tagsChanged =
          JSON.stringify(currentTagsNormalized) !==
          JSON.stringify(updatedTagsArray);

        if (!tagsChanged) {
          return;
        }

        // Create a simple replace operation for the entire tags array
        const jsonPatch = [
          {
            op: 'replace' as const,
            path: '/tags',
            value: updatedTagsArray,
          },
        ];

        // Make the API call using the correct patch API for the entity type
        const patchAPI = entityUtilClassBase.getEntityPatchAPI(entityType);
        if (entityDetails.details.id) {
          await patchAPI(entityDetails.details.id, jsonPatch);
        }

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.glossary-term-plural'),
          })
        );

        // Update the entityData state with the new tags
        setEntityData((prevData: any) => {
          if (!prevData) {
            return prevData;
          }

          const updatedData = {
            ...prevData,
            tags: updatedTags,
            entityType: prevData.entityType || entityDetails.details.entityType,
            fullyQualifiedName:
              prevData.fullyQualifiedName ||
              entityDetails.details.fullyQualifiedName,
            id: prevData.id || entityDetails.details.id,
            description:
              prevData.description || entityDetails.details.description,
            displayName:
              prevData.displayName || entityDetails.details.displayName,
            name: prevData.name || entityDetails.details.name,
            deleted:
              prevData.deleted === undefined
                ? entityDetails.details.deleted
                : prevData.deleted,
            serviceType:
              prevData.serviceType ||
              (entityDetails.details as any).serviceType,
            service: prevData.service || entityDetails.details.service,
            owners: prevData.owners || entityDetails.details.owners,
            domains: prevData.domains || entityDetails.details.domains,
            dataProducts:
              prevData.dataProducts ||
              (entityDetails.details as any).dataProducts,
            tier: prevData.tier || entityDetails.details.tier,
            columnNames:
              prevData.columnNames ||
              (entityDetails.details as any).columnNames,
            database:
              prevData.database || (entityDetails.details as any).database,
            databaseSchema:
              prevData.databaseSchema ||
              (entityDetails.details as any).databaseSchema,
            tableType:
              prevData.tableType || (entityDetails.details as any).tableType,
          };

          return updatedData;
        });
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.glossary-term-plural'),
          })
        );
      }
    },
    [entityData, entityDetails.details, entityType, t]
  );

  const handleDescriptionUpdate = useCallback(
    (updatedDescription: string) => {
      setEntityData((prevData: any) => {
        // If no prevData, create new data object from entityDetails
        if (!prevData) {
          return {
            ...entityDetails.details,
            description: updatedDescription,
          };
        }

        if (prevData.id !== entityDetails.details.id) {
          return prevData;
        }

        const updatedData = {
          ...prevData,
          description: updatedDescription,
          entityType: prevData.entityType || entityDetails.details.entityType,
          fullyQualifiedName:
            prevData.fullyQualifiedName ||
            entityDetails.details.fullyQualifiedName,
          id: prevData.id || entityDetails.details.id,
          displayName:
            prevData.displayName || entityDetails.details.displayName,
          name: prevData.name || entityDetails.details.name,
          deleted:
            prevData.deleted === undefined
              ? entityDetails.details.deleted
              : prevData.deleted,
          serviceType:
            prevData.serviceType || (entityDetails.details as any).serviceType,
          service: prevData.service || entityDetails.details.service,
          owners: prevData.owners || entityDetails.details.owners,
          domains: prevData.domains || entityDetails.details.domains,
          tags: prevData.tags || entityDetails.details.tags,
          dataProducts:
            prevData.dataProducts ||
            (entityDetails.details as any).dataProducts,
          tier: prevData.tier || (entityDetails.details as any).tier,
          columnNames:
            prevData.columnNames || (entityDetails.details as any).columnNames,
          database:
            prevData.database || (entityDetails.details as any).database,
          databaseSchema:
            prevData.databaseSchema ||
            (entityDetails.details as any).databaseSchema,
          tableType:
            prevData.tableType || (entityDetails.details as any).tableType,
        };

        return updatedData;
      });
    },
    [entityDetails.details]
  );

  useEffect(() => {
    if (id) {
      fetchResourcePermission(id);
    }
  }, [id]);

  // Reset activeTab to OVERVIEW when entity changes
  useEffect(() => {
    setActiveTab(EntityRightPanelTab.OVERVIEW);
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
  }, [activeTab, fetchEntityData, fetchEntityTypeDetail, fetchLineageData]);

  const viewPermission = useMemo(
    () => entityPermissions.ViewBasic || entityPermissions.ViewAll,
    [entityPermissions]
  );

  const summaryComponent = useMemo(() => {
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
    const entity = entityDetails.details;

    return (
      <DataAssetSummaryPanel
        componentType={tab === NAV_OPTIONS.lineage ? tab : NAV_OPTIONS.explore}
        dataAsset={
          entity as SearchedDataProps['data'][number]['_source'] & {
            dataProducts: DataProduct[];
          }
        }
        entityType={type}
        highlights={highlights}
      />
    );
  }, [tab, entityDetails, viewPermission, isPermissionLoading]);

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
        onDataProductsUpdate={handleDataProductsUpdate}
        onDescriptionUpdate={handleDescriptionUpdate}
        onDomainUpdate={handleDomainUpdate}
        onGlossaryTermsUpdate={handleGlossaryTermsUpdate}
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
    switch (activeTab) {
      case EntityRightPanelTab.OVERVIEW:
        return (
          <>
            {viewPermission && (
              <div className="title-section">
                <div className="title-container">
                  <Tooltip
                    mouseEnterDelay={0.5}
                    placement="topLeft"
                    title={entityDetails.details.name}
                    trigger="hover">
                    <div className="d-flex items-center">
                      <span className="entity-icon">
                        {searchClassBase.getEntityIcon(
                          entityDetails.details.entityType ?? ''
                        )}
                      </span>
                      <Link
                        className="entity-title-link"
                        data-testid="entity-link"
                        href={entityLink as string}
                        rel="noopener noreferrer"
                        target="_blank"
                        underline="hover">
                        {stringToHTML(getEntityName(entityDetails.details))}
                      </Link>
                    </div>
                  </Tooltip>
                </div>
              </div>
            )}
            <div className="overview-tab-content">{summaryComponentV1}</div>
          </>
        );
      case EntityRightPanelTab.SCHEMA:
        return (
          <>
            {viewPermission && (
              <div className="title-section">
                <div className="title-container">
                  <Tooltip
                    mouseEnterDelay={0.5}
                    placement="topLeft"
                    title={entityDetails.details.name}
                    trigger="hover">
                    <div className="d-flex items-center">
                      <span className="entity-icon">
                        {searchClassBase.getEntityIcon(
                          entityDetails.details.entityType ?? ''
                        )}
                      </span>
                      <Link
                        className="entity-title-link"
                        data-testid="entity-link"
                        href={entityLink as string}
                        rel="noopener noreferrer"
                        target="_blank"
                        underline="hover">
                        {stringToHTML(getEntityName(entityDetails.details))}
                      </Link>
                    </div>
                  </Tooltip>
                </div>
              </div>
            )}
            <div className="entity-summary-panel-tab-content">
              <EntityDetailsSection
                dataAsset={entityDetails.details}
                entityType={entityType}
                highlights={highlights}
                isLoading={isPermissionLoading}
              />
            </div>
          </>
        );
      case EntityRightPanelTab.LINEAGE:
        return (
          <>
            {viewPermission && (
              <div className="title-section">
                <div className="title-container">
                  <Tooltip
                    mouseEnterDelay={0.5}
                    placement="topLeft"
                    title={entityDetails.details.name}
                    trigger="hover">
                    <div className="d-flex items-center">
                      <span className="entity-icon">
                        {searchClassBase.getEntityIcon(
                          entityDetails.details.entityType ?? ''
                        )}
                      </span>
                      <Link
                        className="entity-title-link"
                        data-testid="entity-link"
                        href={entityLink as string}
                        rel="noopener noreferrer"
                        target="_blank"
                        underline="hover">
                        {stringToHTML(getEntityName(entityDetails.details))}
                      </Link>
                    </div>
                  </Tooltip>
                </div>
              </div>
            )}
            <div className="entity-summary-panel-tab-content">
              <div className="p-x-md">{renderLineageContent()}</div>
            </div>
          </>
        );
      case EntityRightPanelTab.DATA_QUALITY:
        return (
          <>
            {viewPermission && (
              <div className="title-section">
                <div className="title-container">
                  <Tooltip
                    mouseEnterDelay={0.5}
                    placement="topLeft"
                    title={entityDetails.details.name}
                    trigger="hover">
                    <div className="d-flex items-center">
                      <span className="entity-icon">
                        {searchClassBase.getEntityIcon(
                          entityDetails.details.entityType ?? ''
                        )}
                      </span>
                      <Link
                        className="entity-title-link"
                        data-testid="entity-link"
                        href={entityLink as string}
                        rel="noopener noreferrer"
                        target="_blank"
                        underline="hover">
                        {stringToHTML(getEntityName(entityDetails.details))}
                      </Link>
                    </div>
                  </Tooltip>
                </div>
              </div>
            )}
            <DataQualityTab
              entityFQN={entityDetails.details.fullyQualifiedName || ''}
              entityType={entityType}
            />
          </>
        );
      case EntityRightPanelTab.CUSTOM_PROPERTIES: {
        return (
          <>
            {viewPermission && (
              <div className="title-section">
                <div className="title-container">
                  <Tooltip
                    mouseEnterDelay={0.5}
                    placement="topLeft"
                    title={entityDetails.details.name}
                    trigger="hover">
                    <div className="d-flex items-center">
                      <span className="entity-icon">
                        {searchClassBase.getEntityIcon(
                          entityDetails.details.entityType ?? ''
                        )}
                      </span>
                      <Link
                        className="entity-title-link"
                        data-testid="entity-link"
                        href={entityLink as string}
                        rel="noopener noreferrer"
                        target="_blank"
                        underline="hover">
                        {stringToHTML(getEntityName(entityDetails.details))}
                      </Link>
                    </div>
                  </Tooltip>
                </div>
              </div>
            )}
            <CustomPropertiesSection
              entityData={entityData}
              entityDetails={entityDetails}
              entityType={entityType}
              entityTypeDetail={entityTypeDetail}
              isEntityDataLoading={isEntityDataLoading}
            />
          </>
        );
      }
      default:
        return summaryComponent;
    }
  };

  return (
    <div className="entity-summary-panel-container">
      <div className="d-flex gap-2">
        <Card bordered={false} className="summary-panel-container">
          <Card
            className="content-area"
            style={{ width: '80%', display: 'block' }}>
            {renderTabContent()}
          </Card>
        </Card>
        <EntityRightPanelVerticalNav
          activeTab={activeTab}
          entityType={entityType}
          onTabChange={handleTabChange}
        />
      </div>
    </div>
  );
}
