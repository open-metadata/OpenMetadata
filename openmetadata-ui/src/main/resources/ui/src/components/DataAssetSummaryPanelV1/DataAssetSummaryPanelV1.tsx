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
import {
  getCurrentMillis,
  getEpochMillisForPastDays,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityChildDetails } from '../../utils/EntitySummaryPanelUtils';
import {
  DRAWER_NAVIGATION_OPTIONS,
  getEntityOverview,
  hasLineageTab,
} from '../../utils/EntityUtils';

import { AxiosError } from 'axios';
import { Operation } from 'fast-json-patch';
import { ENTITY_PATH } from '../../constants/constants';
import { PROFILER_FILTER_RANGE } from '../../constants/profiler.constant';
import { EntityType } from '../../enums/entity.enum';
import { Chart } from '../../generated/entity/data/chart';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { EntityReference } from '../../generated/entity/type';
import { TagLabel, TestCaseStatus } from '../../generated/tests/testCase';
import { TagSource } from '../../generated/type/tagLabel';
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { listTestCases } from '../../rest/testAPI';
import { fetchCharts } from '../../utils/DashboardDetailsUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { generateEntityLink, getTierTags } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DataProductsSection from '../common/DataProductsSection/DataProductsSection';
import DataQualitySection from '../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../common/DescriptionSection/DescriptionSection';
import DomainsSection from '../common/DomainsSection/DomainsSection';
import GlossaryTermsSection from '../common/GlossaryTermsSection/GlossaryTermsSection';
import LineageSection from '../common/LineageSection/LineageSection';
import Loader from '../common/Loader/Loader';
import OverviewSection from '../common/OverviewSection/OverviewSection';
import OwnersSection from '../common/OwnersSection/OwnersSection';
import SummaryPanelSkeleton from '../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsSection from '../common/TagsSection/TagsSection';
import TierSection from '../common/TierSection/TierSection';
import {
  DataAssetSummaryPanelProps,
  TestCaseStatusCounts,
} from '../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1.interface';

export const DataAssetSummaryPanelV1 = ({
  dataAsset,
  entityType,
  isLoading = false,
  componentType = DRAWER_NAVIGATION_OPTIONS.explore,
  highlights,
  onOwnerUpdate,
  panelPath,
  onDomainUpdate,
  onTierUpdate,
  isDomainVisible,
  onTagsUpdate,
  onDataProductsUpdate,
  onGlossaryTermsUpdate,
  onDescriptionUpdate,
  onLinkClick,
  onLineageClick,
}: DataAssetSummaryPanelProps) => {
  const { t } = useTranslation();
  const { getEntityPermission } = usePermissionProvider();

  // Extract tier from tags
  const tier = useMemo(
    () => getTierTags(dataAsset.tags ?? []),
    [dataAsset.tags]
  );

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
            op: dataAsset.description ? 'replace' : 'add',
            path: '/description',
            value: newDescription,
          },
        ];

        // Make the API call using the correct patch API for the entity type
        const patchAPI = entityUtilClassBase.getEntityPatchAPI(entityType);
        const response = await patchAPI(dataAsset.id, jsonPatch as Operation[]);

        // Show success message
        showSuccessToast(
          t('server.update-entity-success', {
            entity: t('label.description'),
          })
        );

        // Update the parent component with the new description from response
        if (onDescriptionUpdate) {
          onDescriptionUpdate(response.description || newDescription);
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
    [dataAsset.id, dataAsset.description, entityType, t, onDescriptionUpdate]
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
  const [statusCounts, setStatusCounts] = useState<TestCaseStatusCounts>({
    success: 0,
    failed: 0,
    aborted: 0,
    ack: 0,
    total: 0,
  });
  const entityInfo = useMemo(
    () => getEntityOverview(entityType, dataAsset, additionalInfo),
    [dataAsset, additionalInfo, entityType]
  );

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

  const shouldShowLineageSection = useMemo(
    () => hasLineageTab(entityType),
    [entityType]
  );

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
  const {
    editDomainPermission,
    editOwnerPermission,
    editTierPermission,
    editTagsPermission,
    editDataProductPermission,
    editDescriptionPermission,
    editGlossaryTermsPermission,
  } = useMemo(
    () => ({
      editDomainPermission:
        entityPermissions?.EditAll &&
        !dataAsset.deleted &&
        panelPath !== ENTITY_PATH.dataProductsTab,
      editDescriptionPermission:
        (entityPermissions?.EditAll || entityPermissions?.EditDescription) &&
        !dataAsset.deleted,
      editGlossaryTermsPermission:
        (entityPermissions?.EditGlossaryTerms || entityPermissions?.EditAll) &&
        !dataAsset.deleted,
      editOwnerPermission:
        (entityPermissions?.EditAll || entityPermissions?.EditOwners) &&
        !dataAsset.deleted,
      editTierPermission:
        (entityPermissions?.EditAll || entityPermissions?.EditTier) &&
        !dataAsset.deleted,
      editTagsPermission:
        (entityPermissions?.EditAll || entityPermissions?.EditTags) &&
        !dataAsset.deleted,
      editDataProductPermission:
        entityPermissions?.EditAll && !dataAsset.deleted,
    }),
    [entityPermissions, dataAsset]
  );

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
  }, [entityPermissions, dataAsset?.fullyQualifiedName]);

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
      case EntityType.GOVERN:
      case EntityType.GLOSSARY:
      case EntityType.GLOSSARY_TERM:
      case EntityType.TAG:
      case EntityType.TEST_SUITE:
      case EntityType.TEST_CASE:
      case EntityType.DOMAIN:
      case EntityType.CLASSIFICATION:
      case EntityType.METADATA_SERVICE:
      case EntityType.SECURITY_SERVICE:
      case EntityType.DRIVE_SERVICE:
      case EntityType.INGESTION_PIPELINE:
      case EntityType.WORKFLOW_DEFINITION:
      case EntityType.DATA_CONTRACT:
      case EntityType.QUERY:
      case EntityType.APPLICATION:
      case EntityType.ALERT:
      case EntityType.EVENT_SUBSCRIPTION:
        return (
          <>
            {entityType === EntityType.TABLE && (
              <span className="d-none" data-testid="TableSummary" />
            )}
            {entityType === EntityType.TOPIC && (
              <span className="d-none" data-testid="TopicSummary" />
            )}
            {entityType === EntityType.DASHBOARD && (
              <span className="d-none" data-testid="DashboardSummary" />
            )}
            {entityType === EntityType.PIPELINE && (
              <span className="d-none" data-testid="PipelineSummary" />
            )}
            {entityType === EntityType.MLMODEL && (
              <span className="d-none" data-testid="MlModelSummary" />
            )}
            {entityType === EntityType.CHART && (
              <span className="d-none" data-testid="ChartSummary" />
            )}
            {entityType === EntityType.DATABASE && (
              <span className="d-none" data-testid="DatabaseSummary" />
            )}
            {entityType === EntityType.DATABASE_SCHEMA && (
              <span className="d-none" data-testid="DatabaseSchemaSummary" />
            )}
            {entityType === EntityType.CONTAINER && (
              <span className="d-none" data-testid="ContainerSummary" />
            )}
            {entityType === EntityType.SEARCH_INDEX && (
              <span className="d-none" data-testid="SearchIndexSummary" />
            )}
            {entityType === EntityType.API_COLLECTION && (
              <span className="d-none" data-testid="APIServiceSummary" />
            )}
            {entityType === EntityType.DIRECTORY && (
              <span className="d-none" data-testid="DirectorySummary" />
            )}
            {entityType === EntityType.DASHBOARD_DATA_MODEL && (
              <span
                className="d-none"
                data-testid="DashboardDataModelSummary"
              />
            )}
            <DescriptionSection
              description={dataAsset.description}
              entityFqn={dataAsset.fullyQualifiedName}
              entityType={entityType}
              hasPermission={editDescriptionPermission}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
            <OverviewSection
              componentType={componentType}
              entityInfoV1={entityInfo}
              isDomainVisible={isDomainVisible}
              onLinkClick={onLinkClick}
            />
            {isTestCaseLoading ? (
              <Loader size="small" />
            ) : (
              entityType === EntityType.TABLE && (
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
            {shouldShowLineageSection && (
              <LineageSection
                entityFqn={dataAsset.fullyQualifiedName}
                entityType={entityType}
                key={`lineage-${dataAsset.id}`}
                onLineageClick={onLineageClick}
              />
            )}
            <div>
              <OwnersSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editOwnerPermission}
                key={`owners-${dataAsset.id}-${
                  (dataAsset.owners as EntityReference[])?.length || 0
                }`}
                owners={dataAsset.owners as EntityReference[]}
                onOwnerUpdate={onOwnerUpdate}
              />
            </div>
            <div>
              <DomainsSection
                domains={dataAsset.domains}
                entityFqn={dataAsset.fullyQualifiedName}
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editDomainPermission}
                key={`domains-${dataAsset.id}-${
                  (dataAsset.domains as EntityReference[])?.length || 0
                }`}
                onDomainUpdate={onDomainUpdate}
              />
            </div>
            <div>
              <TierSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editTierPermission}
                key={`tier-${dataAsset.id}-${tier?.tagFQN || 'no-tier'}`}
                tags={dataAsset.tags}
                tier={tier}
                onTierUpdate={onTierUpdate}
              />
            </div>
            <div>
              <GlossaryTermsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editGlossaryTermsPermission}
                key={`glossary-terms-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                maxVisibleGlossaryTerms={3}
                tags={dataAsset.tags}
                onGlossaryTermsUpdate={onGlossaryTermsUpdate}
              />
            </div>
            <div>
              <TagsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editTagsPermission}
                key={`tags-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags}
                onTagsUpdate={onTagsUpdate}
              />
            </div>
            <div>
              <DataProductsSection
                activeDomains={dataAsset.domains as EntityReference[]}
                dataProducts={dataAsset.dataProducts as EntityReference[]}
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editDataProductPermission}
                key={`data-products-${dataAsset.id}-${
                  (dataAsset.dataProducts as unknown[])?.length || 0
                }`}
                onDataProductsUpdate={onDataProductsUpdate}
              />
            </div>
          </>
        );
      case EntityType.KNOWLEDGE_PAGE:
        return (
          <>
            <span className="d-none" data-testid="KnowledgePageSummary" />
            <DescriptionSection
              description={dataAsset.description}
              entityFqn={dataAsset.fullyQualifiedName}
              entityType={entityType}
              hasPermission={editDescriptionPermission}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
            <div>
              <OwnersSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editOwnerPermission}
                key={`owners-${dataAsset.id}-${
                  (dataAsset.owners as EntityReference[])?.length || 0
                }`}
                owners={dataAsset.owners as EntityReference[]}
                onOwnerUpdate={onOwnerUpdate}
              />
            </div>
            <div>
              <TagsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editTagsPermission}
                key={`tags-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags}
                onTagsUpdate={onTagsUpdate}
              />
            </div>
            <div>
              <GlossaryTermsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editGlossaryTermsPermission}
                key={`glossary-terms-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                maxVisibleGlossaryTerms={3}
                tags={dataAsset.tags}
                onGlossaryTermsUpdate={onGlossaryTermsUpdate}
              />
            </div>
          </>
        );
      case EntityType.DATA_PRODUCT:
        return (
          <>
            <DescriptionSection
              description={dataAsset.description}
              entityFqn={dataAsset.fullyQualifiedName}
              entityType={entityType}
              hasPermission={editDescriptionPermission}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
            <div>
              <OwnersSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editOwnerPermission}
                key={`owners-${dataAsset.id}-${
                  (dataAsset.owners as EntityReference[])?.length || 0
                }`}
                owners={dataAsset.owners as EntityReference[]}
                onOwnerUpdate={onOwnerUpdate}
              />
            </div>
            <div>
              <DomainsSection
                domains={dataAsset.domains}
                entityFqn={dataAsset.fullyQualifiedName}
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editDomainPermission}
                key={`domains-${dataAsset.id}-${
                  (dataAsset.domains as EntityReference[])?.length || 0
                }`}
                onDomainUpdate={onDomainUpdate}
              />
            </div>
            <div>
              <TierSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editTierPermission}
                key={`tier-${dataAsset.id}-${tier?.tagFQN || 'no-tier'}`}
                tags={dataAsset.tags}
                tier={tier}
                onTierUpdate={onTierUpdate}
              />
            </div>
            <div>
              <TagsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={editTagsPermission}
                key={`tags-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags?.filter(
                  (tag: TagLabel) => tag.source !== TagSource.Glossary
                )}
                onTagsUpdate={onTagsUpdate}
              />
            </div>
          </>
        );
      case EntityType.USER:
      case EntityType.TEAM:
      case EntityType.ROLE:
      case EntityType.POLICY:
      case EntityType.BOT:
      case EntityType.WEBHOOK:
      case EntityType.PERSONA:
      case EntityType.KPI:
      case EntityType.DATA_INSIGHT_CHART:
      case EntityType.DOC_STORE:
      case EntityType.TYPE:
      case EntityType.SAMPLE_DATA:
      case EntityType.CUSTOM_METRIC:
      case EntityType.NOTIFICATION_TEMPLATE:
      case EntityType.INGESTION_RUNNER:
      case EntityType.APP_MARKET_PLACE_DEFINITION:
      case EntityType.SERVICE:
      case EntityType.SUBSCRIPTION:
      case EntityType.LINEAGE_EDGE:
      case EntityType.ENTITY_REPORT_DATA:
      case EntityType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA:
      case EntityType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA:
      case EntityType.TEST_CASE_RESOLUTION_STATUS:
      case EntityType.TEST_CASE_RESULT:
      case EntityType.ALL:
      case EntityType.PAGE:
      case EntityType.knowledgePanels:
        return (
          <>
            <DescriptionSection
              description={dataAsset.description}
              entityFqn={dataAsset.fullyQualifiedName}
              entityType={entityType}
              hasPermission={editDescriptionPermission}
              onDescriptionUpdate={handleDescriptionUpdate}
            />
            <OverviewSection
              componentType={componentType}
              entityInfoV1={entityInfo}
              isDomainVisible={isDomainVisible}
              onLinkClick={onLinkClick}
            />
            {dataAsset.owners && (
              <div>
                <OwnersSection
                  entityId={dataAsset.id}
                  entityType={entityType}
                  hasPermission={editOwnerPermission}
                  key={`owners-${dataAsset.id}-${
                    (dataAsset.owners as EntityReference[])?.length || 0
                  }`}
                  owners={dataAsset.owners as EntityReference[]}
                  onOwnerUpdate={onOwnerUpdate}
                />
              </div>
            )}
            {dataAsset.tags && (
              <div>
                <TagsSection
                  entityId={dataAsset.id}
                  entityType={entityType}
                  hasPermission={editTagsPermission}
                  key={`tags-${dataAsset.id}-${
                    (dataAsset.tags as unknown[])?.length || 0
                  }`}
                  tags={dataAsset.tags?.filter(
                    (tag: TagLabel) => tag.source !== TagSource.Glossary
                  )}
                  onTagsUpdate={onTagsUpdate}
                />
              </div>
            )}
          </>
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
      <div className="d-flex flex-col gap-4">{commonEntitySummaryInfo}</div>
    </SummaryPanelSkeleton>
  );
};
