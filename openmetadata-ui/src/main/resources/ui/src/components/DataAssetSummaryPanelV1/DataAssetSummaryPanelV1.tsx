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
import { isEmpty, startCase } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { getListTestCaseIncidentStatus } from '../../rest/incidentManagerAPI';
import { listTestCases } from '../../rest/testAPI';
import { fetchCharts } from '../../utils/DashboardDetailsUtils';
import { getEpochMillisForPastDays } from '../../utils/date-time/DateTimeUtils';
import { generateEntityLink } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import DataProductsSection from '../common/DataProductsSection/DataProductsSection';
import DataQualitySection from '../common/DataQualitySection/DataQualitySection';
import DescriptionSection from '../common/DescriptionSection/DescriptionSection';
import DomainsSection from '../common/DomainsSection/DomainsSection';
import GlossaryTermsSection from '../common/GlossaryTermsSection/GlossaryTermsSection';
import Loader from '../common/Loader/Loader';
import OverviewSection from '../common/OverviewSection/OverviewSection';
import OwnersSection from '../common/OwnersSection/OwnersSection';
import QueryCount from '../common/QueryCount/QueryCount.component';
import SummaryPanelSkeleton from '../common/Skeleton/SummaryPanelSkeleton/SummaryPanelSkeleton.component';
import TagsSection from '../common/TagsSection/TagsSection';
import { DataAssetSummaryPanelProps } from '../DataAssetSummaryPanelV1/DataAssetSummaryPanelV1.interface';
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
  onTagsUpdate,
  onDataProductsUpdate,
  onGlossaryTermsUpdate,
}: DataAssetSummaryPanelProps) => {
  const { getEntityPermission } = usePermissionProvider();
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
    if (!dataAsset?.fullyQualifiedName) {
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
    if (dataAsset.id && !isTourPage) {
      const permissions = await getEntityPermission(
        ResourceEntity.TABLE,
        dataAsset.id
      );
      setEntityPermissions(permissions);
    } else {
      setEntityPermissions(null);
    }
  }, [dataAsset, isTourPage, isEntityDeleted, getEntityPermission]);

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
        return (
          <>
            <DescriptionSection
              description={dataAsset.description}
              onDescriptionUpdate={async () => {
                // Handle description update
                // TODO: Implement actual API call to update description
                // Example: await updateEntityDescription(dataAsset.id, newDescription);
              }}
            />
            <OverviewSection
              items={[
                { label: 'Type', value: startCase(dataAsset?.entityType) },
                { label: 'Rows', value: '344' },
                {
                  label: 'Columns',
                  // @ts-expect-error TODO: fix
                  value: dataAsset?.columnNames?.length || 0,
                },
                {
                  label: 'Queries',
                  value: <QueryCount tableId={dataAsset.id || ''} />,
                },
                {
                  label: 'Incidents',
                  value: additionalInfo?.incidentCount ?? 0,
                },
              ]}
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
              <GlossaryTermsSection
                entityId={dataAsset.id}
                entityType={entityType}
                hasPermission={
                  entityPermissions?.EditAll || entityPermissions?.EditTags
                }
                tags={dataAsset.tags}
                onGlossaryTermsUpdate={onGlossaryTermsUpdate}
              />
            </div>
            <div className="section-container">
              <TagsSection
                entityId={dataAsset.id}
                hasPermission={
                  entityPermissions?.EditAll || entityPermissions?.EditTags
                }
                key={`tags-${dataAsset.id}-${
                  (dataAsset.tags as unknown[])?.length || 0
                }`}
                tags={dataAsset.tags}
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
      case EntityType.GLOSSARY_TERM:
      case EntityType.TAG:
      case EntityType.DATA_PRODUCT:
      default:
        return null;
    }
  }, [entityType, dataAsset, entityInfo, componentType, statusCounts]);

  useEffect(() => {
    init();
  }, [dataAsset.id]);

  return (
    <SummaryPanelSkeleton loading={isLoading || isEmpty(dataAsset)}>
      <div className="d-flex flex-col gap-4">{commonEntitySummaryInfo}</div>
    </SummaryPanelSkeleton>
  );
};
