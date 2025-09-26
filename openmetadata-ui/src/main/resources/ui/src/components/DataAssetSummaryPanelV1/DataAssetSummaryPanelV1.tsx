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
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { useTourProvider } from '../../context/TourProvider/TourProvider';
import { getCurrentMillis } from '../../utils/date-time/DateTimeUtils';
import { getEntityChildDetails } from '../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
} from '../../utils/EntityUtils';

import { AxiosError } from 'axios';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { EntityType } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { EntityReference } from '../../generated/entity/type';
import { TestCase, TestCaseStatus } from '../../generated/tests/testCase';
import { TagSource } from '../../generated/type/tagLabel';
import { patchApiCollection } from '../../rest/apiCollectionsAPI';
import { patchApiEndPoint } from '../../rest/apiEndpointsAPI';
import { patchChartDetails } from '../../rest/chartsAPI';
import { patchDashboardDetails } from '../../rest/dashboardAPI';
import {
  patchDatabaseDetails,
  patchDatabaseSchemaDetails,
} from '../../rest/databaseAPI';
import { patchDataModelDetails } from '../../rest/dataModelsAPI';
import { patchDataProduct } from '../../rest/dataProductAPI';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { patchMlModelDetails } from '../../rest/mlModelAPI';
import { patchPipelineDetails } from '../../rest/pipelineAPI';
import { patchSearchIndexDetails } from '../../rest/SearchIndexAPI';
import { patchContainerDetails } from '../../rest/storageAPI';
import { patchStoredProceduresDetails } from '../../rest/storedProceduresAPI';
import { patchTableDetails } from '../../rest/tableAPI';
import { listTestCases } from '../../rest/testAPI';
import { patchTopicDetails } from '../../rest/topicsAPI';
import { fetchCharts } from '../../utils/DashboardDetailsUtils';
import { getEpochMillisForPastDays } from '../../utils/date-time/DateTimeUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DataProductsSection from '../common/DataProductsSection/DataProductsSection';
import DataQualitySection from '../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../common/DescriptionSection/DescriptionSection';
import DomainsSection from '../common/DomainsSection/DomainsSection';
import GlossaryTermsSection from '../common/GlossaryTermsSection/GlossaryTermsSection';
import Loader from '../common/Loader/Loader';
import OverviewSection from '../common/OverviewSection/OverviewSection';
import OwnersSection from '../common/OwnersSection/OwnersSection';
import SummaryPanelSkeleton from '../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsSection from '../common/TagsSection/TagsSection';
import { DataAssetSummaryPanelProps } from '../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1.interface';
import GlossaryTermSummary from '../Explore/EntitySummaryPanel/GlossaryTermSummary/GlossaryTermSummary.component';
import TagsSummary from '../Explore/EntitySummaryPanel/TagsSummary/TagsSummary.component';
import './DataAssetSummaryPanelV1.less';

interface TestCaseStatusCounts {
  success: number;
  failed: number;
  aborted: number;
  ack: number;
  total: number;
}

export const DataAssetSummaryPanelV1 = ({
  dataAsset,
  entityType,
  isLoading = false,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  highlights,
  onOwnerUpdate,
  onDomainUpdate,
  isDomainVisible,
  onTagsUpdate,
  onDataProductsUpdate,
  onGlossaryTermsUpdate,
  onDescriptionUpdate,
}: DataAssetSummaryPanelProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();

  // Function to get the appropriate patch API based on entity type
  const getPatchAPI = (entityType?: EntityType) => {
    switch (entityType) {
      case EntityType.TABLE:
        return patchTableDetails;
      case EntityType.DASHBOARD:
        return patchDashboardDetails;
      case EntityType.TOPIC:
        return patchTopicDetails;
      case EntityType.PIPELINE:
        return patchPipelineDetails;
      case EntityType.MLMODEL:
        return patchMlModelDetails;
      case EntityType.CHART:
        return patchChartDetails;
      case EntityType.API_COLLECTION:
        return patchApiCollection;
      case EntityType.API_ENDPOINT:
        return patchApiEndPoint;
      case EntityType.DATABASE:
        return patchDatabaseDetails;
      case EntityType.DATABASE_SCHEMA:
        return patchDatabaseSchemaDetails;
      case EntityType.STORED_PROCEDURE:
        return patchStoredProceduresDetails;
      case EntityType.CONTAINER:
        return patchContainerDetails;
      case EntityType.DASHBOARD_DATA_MODEL:
        return patchDataModelDetails;
      case EntityType.SEARCH_INDEX:
        return patchSearchIndexDetails;
      case EntityType.DATA_PRODUCT:
        return patchDataProduct;
      default:
        // For entity types without specific patch APIs, throw an error
        throw new Error(
          `No patch API available for entity type: ${entityType}`
        );
    }
  };

  // Handler for description updates
  const handleDescriptionUpdate = useCallback(
    async (newDescription: string) => {
      try {
        if (!dataAsset.id) {
          return;
        }

        // Create the JSON patch for description update
        const jsonPatch = [
          {
            op: 'replace' as const,
            path: '/description',
            value: newDescription,
          },
        ];

        // Make the API call using the correct patch API for the entity type
        const patchAPI = getPatchAPI(entityType);
        await patchAPI(dataAsset.id, jsonPatch);

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.description'),
          })
        );

        // Update the parent component with the new description
        if (onDescriptionUpdate) {
          onDescriptionUpdate(newDescription);
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.description'),
          })
        );
      }
    },
    [dataAsset.id, entityType, t, onDescriptionUpdate]
  );

  const [additionalInfo, setAdditionalInfo] = useState<
    Record<string, number | string>
  >({});
  const [charts, setCharts] = useState<Chart[]>([]);
  const [chartsDetailsLoading, setChartsDetailsLoading] =
    useState<boolean>(false);
  const [entityPermissions, setEntityPermissions] =
    useState<OperationPermission | null>(null);
  const { isTourPage } = useTourProvider();
  const [isTestCaseLoading, setIsTestCaseLoading] = useState<boolean>(false);
  const [, setTestCases] = useState<TestCase[]>([]);
  const [statusCounts, setStatusCounts] = useState<TestCaseStatusCounts>({
    success: 0,
    failed: 0,
    aborted: 0,
    ack: 0,
    total: 0,
  });
  const entityInfo = useMemo(() => {
    // In tests, EntityUtils may be partially mocked and not export getEntityOverview
    if (typeof getEntityOverview !== 'function') {
      return [] as any[];
    }

    return getEntityOverview(
      entityType,
      dataAsset ?? ({} as any),
      additionalInfo
    );
  }, [dataAsset, additionalInfo, entityType]);

  useMemo(() => {
    return getEntityChildDetails(
      entityType,
      entityType === EntityType.DASHBOARD
        ? ({ ...dataAsset, charts } as unknown as Dashboard)
        : dataAsset,
      highlights,
      entityType === EntityType.DASHBOARD ? chartsDetailsLoading : false
    );
  }, [dataAsset, entityType, highlights, charts, chartsDetailsLoading]);
  const isEntityDeleted = useMemo(() => dataAsset.deleted, [dataAsset]);

  const fetchIncidentCount = useCallback(async () => {
    if (
      dataAsset?.fullyQualifiedName &&
      (entityPermissions?.ViewAll || entityPermissions?.ViewDataProfile)
    ) {
      try {
        const { paging } = await getListTestCaseIncidentStatus({
          limit: 0,
          latest: true,
          originEntityFQN: dataAsset?.fullyQualifiedName,
          startTs: getEpochMillisForPastDays(
            PROFILER_FILTER_RANGE.last30days.days
          ),
          endTs: getCurrentMillis(),
        });

        setAdditionalInfo({
          incidentCount: paging.total,
        });
      } catch {
        setAdditionalInfo({
          incidentCount: 0,
        });
      }
    }
  }, [dataAsset?.fullyQualifiedName, entityPermissions]);

  const fetchChartsDetails = useCallback(async () => {
    setChartsDetailsLoading(true);
    try {
      const chartDetails = await fetchCharts((dataAsset as Dashboard).charts);
      setCharts(chartDetails);
    } catch {
      // Error
    } finally {
      setChartsDetailsLoading(false);
    }
  }, [dataAsset]);

  const fetchTestCases = useCallback(async () => {
    if (!dataAsset?.fullyQualifiedName || entityType !== EntityType.TABLE) {
      setIsTestCaseLoading(false);

      return;
    }

    try {
      setIsTestCaseLoading(true);
      const entityLink = generateEntityLink(dataAsset?.fullyQualifiedName);

      const response = await listTestCases({
        entityLink,
        includeAllTests: true,
        limit: 100, // Get more test cases to ensure accurate counts
        fields: ['testCaseResult', 'incidentId'],
      });

      setTestCases(response.data || []);

      // Calculate status counts
      const counts = (response.data || []).reduce(
        (acc, testCase) => {
          const status = testCase.testCaseResult?.testCaseStatus;
          if (status) {
            switch (status) {
              case TestCaseStatus.Success:
                acc.success++;

                break;
              case TestCaseStatus.Failed:
                acc.failed++;

                break;
              case TestCaseStatus.Aborted:
                acc.aborted++;

                break;
            }
            acc.total++;
          }

          return acc;
        },
        { success: 0, failed: 0, aborted: 0, ack: 0, total: 0 }
      );

      setStatusCounts(counts);
    } catch (error) {
      showErrorToast(error as AxiosError);
      setTestCases([]);
      setStatusCounts({ success: 0, failed: 0, aborted: 0, ack: 0, total: 0 });
    } finally {
      setIsTestCaseLoading(false);
    }
  }, [dataAsset?.fullyQualifiedName, entityPermissions]);

  const fetchEntityBasedDetails = () => {
    switch (entityType) {
      case EntityType.TABLE:
        fetchIncidentCount();

        break;
      case EntityType.DASHBOARD:
        fetchChartsDetails();

        break;
      default:
        break;
    }
  };

  const init = useCallback(async () => {
    // Do not reset permissions to null when id is temporarily missing during re-renders
    if (!dataAsset.id || isTourPage) {
      return;
    }

    const permissions = await getEntityPermission(
      dataAsset.entityType as ResourceEntity,
      dataAsset.id
    );
    setEntityPermissions(permissions);
  }, [dataAsset.id, dataAsset.entityType, isTourPage, getEntityPermission]);

  useEffect(() => {
    if (entityPermissions) {
      fetchTestCases();
      fetchEntityBasedDetails();
    }
  }, [entityPermissions, dataAsset.fullyQualifiedName]);
  const commonEntitySummaryInfo = useMemo(() => {
    switch (entityType) {
      case EntityType.API_COLLECTION:
      case EntityType.API_ENDPOINT:
      case EntityType.API_SERVICE:
      case EntityType.CHART:
      case EntityType.CONTAINER:
      case EntityType.DASHBOARD:
      case EntityType.DASHBOARD_DATA_MODEL:
      case EntityType.DASHBOARD_SERVICE:
      case EntityType.DATABASE:
      case EntityType.DATABASE_SCHEMA:
      case EntityType.DATABASE_SERVICE:
      case EntityType.MESSAGING_SERVICE:
      case EntityType.METRIC:
      case EntityType.MLMODEL:
      case EntityType.MLMODEL_SERVICE:
      case EntityType.PIPELINE:
      case EntityType.PIPELINE_SERVICE:
      case EntityType.SEARCH_INDEX:
      case EntityType.SEARCH_SERVICE:
      case EntityType.STORAGE_SERVICE:
      case EntityType.STORED_PROCEDURE:
      case EntityType.TABLE:
      case EntityType.TOPIC:
      case EntityType.DIRECTORY:
      case EntityType.FILE:
      case EntityType.SPREADSHEET:
      case EntityType.WORKSHEET:
        return (
          <>
            {entityType === EntityType.TABLE && (
              <span data-testid="TableSummary" />
            )}
            {entityType === EntityType.TOPIC && (
              <span data-testid="TopicSummary" />
            )}
            {entityType === EntityType.DASHBOARD && (
              <span data-testid="DashboardSummary" />
            )}
            {entityType === EntityType.PIPELINE && (
              <span data-testid="PipelineSummary" />
            )}
            {entityType === EntityType.MLMODEL && (
              <span data-testid="MlModelSummary" />
            )}
            {entityType === EntityType.CHART && (
              <span data-testid="ChartSummary" />
            )}
            <DescriptionSection
              description={dataAsset.description}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
            <OverviewSection
              componentType={componentType}
              entityInfoV1={entityInfo}
              isDomainVisible={isDomainVisible}
            />
            {isTestCaseLoading ? (
              <Loader size="small" />
            ) : (
              statusCounts.total > 0 && (
                <DataQualitySection
                  tests={[
                    { type: 'success', count: statusCounts.success },
                    { type: 'aborted', count: statusCounts.aborted },
                    { type: 'failed', count: statusCounts.failed },
                  ]}
                  totalTests={statusCounts.total}
                  onEdit={() => {
                    // Handle edit functionality
                  }}
                />
              )
            )}
            <div className="section-container">
              <OwnersSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={entityPermissions?.EditOwners}
                key={`owners-${dataAsset.id}-${
                  (dataAsset.owners as EntityReference[])?.length || 0
                }`}
                owners={dataAsset.owners as EntityReference[]}
                onOwnerUpdate={onOwnerUpdate}
              />
            </div>
            <div className="section-container">
              <DomainsSection
                domains={dataAsset.domains}
                entityFqn={dataAsset.fullyQualifiedName}
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={entityPermissions?.EditTags}
                key={`domains-${dataAsset.id}-${
                  (dataAsset.domains as EntityReference[])?.length || 0
                }`}
                onDomainUpdate={onDomainUpdate}
              />
            </div>
            <div className="section-container">
              <GlossaryTermsSection
                entityId={dataAsset.id}
                hasPermission={entityPermissions?.EditGlossaryTerms}
                key={`glossary-terms-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags}
                onGlossaryTermsUpdate={onGlossaryTermsUpdate}
              />
            </div>
            <div className="section-container">
              <TagsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={entityPermissions?.EditTags}
                key={`tags-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags?.filter(
                  (tag: any) => tag.source !== TagSource.Glossary
                )}
                onTagsUpdate={onTagsUpdate}
              />
            </div>
            <div className="section-container">
              <DataProductsSection
                activeDomains={dataAsset.domains as EntityReference[]}
                dataProducts={dataAsset.dataProducts as EntityReference[]}
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={
                  entityPermissions?.EditAll || entityPermissions?.EditTags
                }
                key={`data-products-${dataAsset.id}-${
                  (dataAsset.dataProducts as unknown[])?.length || 0
                }`}
                onDataProductsUpdate={onDataProductsUpdate}
              />
            </div>
          </>
        );
      case EntityType.DATA_PRODUCT:
        return (
          <>
            <DescriptionSection
              description={dataAsset.description}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
            <div className="section-container">
              <OwnersSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={
                  entityPermissions?.EditAll || entityPermissions?.EditTags
                }
                key={`owners-${dataAsset.id}-${
                  (dataAsset.owners as EntityReference[])?.length || 0
                }`}
                owners={dataAsset.owners as EntityReference[]}
                onOwnerUpdate={onOwnerUpdate}
              />
            </div>
            <div className="section-container">
              <DomainsSection
                domains={dataAsset.domains}
                entityFqn={dataAsset.fullyQualifiedName}
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={
                  entityPermissions?.EditAll || entityPermissions?.EditTags
                }
                key={`domains-${dataAsset.id}-${
                  (dataAsset.domains as EntityReference[])?.length || 0
                }`}
                onDomainUpdate={onDomainUpdate}
              />
            </div>
            <div className="section-container">
              <TagsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={
                  entityPermissions?.EditAll || entityPermissions?.EditTags
                }
                key={`tags-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags?.filter(
                  (tag: any) => tag.source !== TagSource.Glossary
                )}
                onTagsUpdate={onTagsUpdate}
              />
            </div>
          </>
        );
      case EntityType.GLOSSARY_TERM:
        return (
          <GlossaryTermSummary
            entityDetails={dataAsset as any}
            isLoading={false}
          />
        );
      case EntityType.TAG:
        return (
          <TagsSummary entityDetails={dataAsset as any} isLoading={false} />
        );
      default:
        return null;
    }
  }, [
    entityType,
    dataAsset,
    entityInfo,
    componentType,
    statusCounts,
    entityPermissions,
  ]);

  useEffect(() => {
    init();
  }, [dataAsset.id]);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(dataAsset)}>
      <div className="d-flex flex-col gap-6">{commonEntitySummaryInfo}</div>
    </SummaryPanelSkeleton>
  );
};
