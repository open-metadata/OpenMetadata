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

import { Button, Col, Row, Space, Tabs, TabsProps, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import { compare, Operation } from 'fast-json-patch';
import { isEmpty, isUndefined, startCase, toString } from 'lodash';
import {
  PagingWithoutTotal,
  ServicesUpdateRequest,
  ServiceTypes,
} from 'Models';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import AirflowMessageBanner from '../../components/common/AirflowMessageBanner/AirflowMessageBanner';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import { PagingHandlerParams } from '../../components/common/NextPrevious/NextPrevious.interface';
import TabsLabel from '../../components/common/TabsLabel/TabsLabel.component';
import TestConnection from '../../components/common/TestConnection/TestConnection';
import DataModelTable from '../../components/Dashboard/DataModel/DataModels/DataModelsTable';
import { DataAssetsHeader } from '../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import { EntityName } from '../../components/Modals/EntityNameModal/EntityNameModal.interface';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import ServiceInsightsTab from '../../components/ServiceInsights/ServiceInsightsTab';
import { WorkflowStatesData } from '../../components/ServiceInsights/ServiceInsightsTab.interface';
import Ingestion from '../../components/Settings/Services/Ingestion/Ingestion.component';
import ServiceConnectionDetails from '../../components/Settings/Services/ServiceConnectionDetails/ServiceConnectionDetails.component';
import {
  INITIAL_PAGING_VALUE,
  PAGE_SIZE_BASE,
  pagingObject,
  ROUTES,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME } from '../../constants/ServiceInsightsTab.constants';
import {
  OPEN_METADATA,
  SERVICE_INGESTION_PIPELINE_TYPES,
} from '../../constants/Services.constant';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../context/PermissionProvider/PermissionProvider.interface';
import { ClientErrors } from '../../enums/Axios.enum';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityTabs, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceAgentSubTabs, ServiceCategory } from '../../enums/service.enum';
import { AgentType, App } from '../../generated/entity/applications/app';
import { Tag } from '../../generated/entity/classification/tag';
import { DashboardConnection } from '../../generated/entity/services/dashboardService';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { WorkflowStatus } from '../../generated/governance/workflows/workflowInstance';
import { Include } from '../../generated/type/include';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { usePaging } from '../../hooks/paging/usePaging';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { useFqn } from '../../hooks/useFqn';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getApiCollections } from '../../rest/apiCollectionsAPI';
import { getApplicationList } from '../../rest/applicationAPI';
import {
  getDashboards,
  getDataModels,
  ListDataModelParams,
} from '../../rest/dashboardAPI';
import { getDatabases } from '../../rest/databaseAPI';
import { getIngestionPipelines } from '../../rest/ingestionPipelineAPI';
import { getMlModels } from '../../rest/mlModelAPI';
import { getPipelines } from '../../rest/pipelineAPI';
import { searchQuery } from '../../rest/searchAPI';
import { getSearchIndexes } from '../../rest/SearchIndexAPI';
import {
  getServiceByFQN,
  patchService,
  restoreService,
} from '../../rest/serviceAPI';
import { getContainers } from '../../rest/storageAPI';
import { getTopics } from '../../rest/topicsAPI';
import {
  getWorkflowInstancesForApplication,
  getWorkflowInstanceStateById,
} from '../../rest/workflowAPI';
import { getEntityMissingError } from '../../utils/CommonUtils';
import {
  getCurrentMillis,
  getDayAgoStartGMTinMillis,
} from '../../utils/date-time/DateTimeUtils';
import entityUtilClassBase from '../../utils/EntityUtilClassBase';
import { getEntityFeedLink, getEntityName } from '../../utils/EntityUtils';
import { removeAutoPilotStatus } from '../../utils/LocalStorageUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getEditConnectionPath,
  getServiceDetailsPath,
  getServiceVersionPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getCountLabel,
  getEntityTypeFromServiceCategory,
  getResourceEntityFromServiceCategory,
  getServiceDisplayNameQueryFilter,
  getServiceRouteFromServiceType,
  shouldTestConnection,
} from '../../utils/ServiceUtils';
import {
  escapeESReservedCharacters,
  getEncodedFqn,
} from '../../utils/StringsUtils';
import { updateTierTag } from '../../utils/TagsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './service-details-page.less';
import { ServicePageData } from './ServiceDetailsPage.interface';
import ServiceMainTabContent from './ServiceMainTabContent';

const ServiceDetailsPage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const airflowInformation = useAirflowStatus();
  const { isAirflowAvailable } = useMemo(
    () => airflowInformation,
    [airflowInformation]
  );
  const { serviceCategory, tab } = useParams<{
    serviceCategory: ServiceTypes;
    tab: string;
  }>();
  const { fqn: decodedServiceFQN } = useFqn();
  const isMetadataService = useMemo(
    () => serviceCategory === ServiceCategory.METADATA_SERVICES,
    [serviceCategory]
  );
  const isOpenMetadataService = useMemo(
    () => decodedServiceFQN === OPEN_METADATA,
    [decodedServiceFQN]
  );
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const ingestionPagingInfo = usePaging(PAGE_SIZE_BASE);
  const collateAgentPagingInfo = usePaging(PAGE_SIZE_BASE);
  const pagingInfo = usePaging(PAGE_SIZE_BASE);
  const [workflowStatesData, setWorkflowStatesData] =
    useState<WorkflowStatesData>();
  const [isWorkflowStatusLoading, setIsWorkflowStatusLoading] = useState(true);

  const {
    paging: collateAgentPaging,
    pageSize: collateAgentPageSize,
    pagingCursor: collateAgentPagingCursor,
    handlePageChange: handleCollateAgentPageChange,
    handlePagingChange: handleCollateAgentPagingChange,
  } = collateAgentPagingInfo;

  const {
    paging: ingestionPaging,
    currentPage: currentIngestionPage,
    pageSize: ingestionPageSize,
    pagingCursor: ingestionPagingCursor,
    handlePageChange: handleIngestionPageChange,
    handlePagingChange: handleIngestionPagingChange,
  } = ingestionPagingInfo;

  const {
    paging,
    pageSize,
    currentPage,
    handlePageChange,
    handlePagingChange,
  } = pagingInfo;

  const [serviceDetails, setServiceDetails] = useState<ServicesType>(
    {} as ServicesType
  );
  const [data, setData] = useState<Array<ServicePageData>>([]);
  const [isLoading, setIsLoading] = useState(!isOpenMetadataService);
  const [isIngestionPipelineLoading, setIsIngestionPipelineLoading] =
    useState(false);
  const [isServiceLoading, setIsServiceLoading] = useState(true);
  const [dataModelPaging, setDataModelPaging] = useState<Paging>(pagingObject);
  const [ingestionPipelines, setIngestionPipelines] = useState<
    IngestionPipeline[]
  >([]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [connectionDetails, setConnectionDetails] = useState<ConfigData>();
  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [statusFilter, setStatusFilter] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [isCollateAgentLoading, setIsCollateAgentLoading] = useState(false);
  const [collateAgentsList, setCollateAgentsList] = useState<App[]>([]);

  const { CollateAIAgentsWidget } = useMemo(
    () => serviceUtilClassBase.getAgentsTabWidgets(),
    []
  );
  const isDBService = useMemo(
    () => serviceCategory === ServiceCategory.DATABASE_SERVICES,
    [serviceCategory]
  );
  const isCollateAIWidgetSupported = useMemo(
    () => !isUndefined(CollateAIAgentsWidget) && isDBService,
    [CollateAIAgentsWidget, isDBService]
  );
  const handleTypeFilterChange = useCallback(
    (type: Array<{ key: string; label: string }>) => {
      setTypeFilter(type);
    },
    []
  );

  const handleStatusFilterChange = useCallback(
    (status: Array<{ key: string; label: string }>) => {
      setStatusFilter(status);
    },
    []
  );

  const activeTab = useMemo(() => {
    if (tab) {
      return tab;
    }
    if (isMetadataService) {
      return EntityTabs.AGENTS;
    }

    return EntityTabs.INSIGHTS;
  }, [tab, serviceCategory, isMetadataService]);

  const handleSearchChange = useCallback(
    (searchValue: string) => {
      handleIngestionPageChange(INITIAL_PAGING_VALUE);
      setSearchText(searchValue);
    },
    [handleIngestionPageChange]
  );

  const handleIngestionListUpdate = useCallback(
    (ingestionList: React.SetStateAction<IngestionPipeline[]>) => {
      setIngestionPipelines(ingestionList);
    },
    []
  );

  const extraDropdownContent = useMemo(
    () =>
      entityUtilClassBase.getManageExtraOptions(
        getEntityTypeFromServiceCategory(serviceCategory),
        decodedServiceFQN,
        servicePermission,
        serviceDetails
      ),
    [servicePermission, decodedServiceFQN, serviceCategory, serviceDetails, tab]
    // Don't remove the tab dependency, it's used to disable the PDF Export dropdown options
  );

  const handleShowDeleted = useCallback(
    (value: boolean) => {
      setShowDeleted(value);
      handlePageChange(INITIAL_PAGING_VALUE);
    },
    [handlePageChange]
  );

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(serviceCategory);
  }, [serviceCategory]);

  const { version: currentVersion, deleted } = useMemo(
    () => serviceDetails,
    [serviceDetails]
  );

  const fetchServicePermission = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        getResourceEntityFromServiceCategory(serviceCategory),
        decodedServiceFQN
      );
      setServicePermission(response);
    } finally {
      setIsLoading(false);
    }
  }, [serviceCategory, decodedServiceFQN]);

  const goToEditConnection = useCallback(() => {
    history.push(
      getEditConnectionPath(serviceCategory ?? '', decodedServiceFQN ?? '')
    );
  }, [serviceCategory, decodedServiceFQN]);

  const activeTabHandler = useCallback(
    (key: string) => {
      if (key !== activeTab) {
        let subTab = undefined;
        const isAgentTab = key === EntityTabs.AGENTS;

        if (isAgentTab) {
          subTab = ServiceAgentSubTabs.METADATA;
        }

        history.push({
          pathname: getServiceDetailsPath(
            decodedServiceFQN,
            serviceCategory,
            key,
            subTab
          ),
        });
      }
    },
    [activeTab, decodedServiceFQN, serviceCategory]
  );

  const fetchWorkflowInstanceStates = useCallback(async () => {
    try {
      setIsWorkflowStatusLoading(true);
      const startTs = getDayAgoStartGMTinMillis(6);
      const endTs = getCurrentMillis();
      const entityType = getEntityTypeFromServiceCategory(serviceCategory);
      const workflowInstances = await getWorkflowInstancesForApplication({
        startTs,
        endTs,
        workflowDefinitionName: SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
        entityLink: getEntityFeedLink(
          entityType,
          serviceDetails.fullyQualifiedName
        ),
      });

      const workflowInstanceId = workflowInstances.data[0]?.id;

      if (workflowInstanceId) {
        const workflowInstanceStates = await getWorkflowInstanceStateById(
          SERVICE_INSIGHTS_WORKFLOW_DEFINITION_NAME,
          workflowInstanceId,
          {
            startTs,
            endTs,
          }
        );
        setWorkflowStatesData({
          mainInstanceState: workflowInstances.data[0],
          subInstanceStates: workflowInstanceStates.data,
        });
      }
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsWorkflowStatusLoading(false);
    }
  }, [serviceDetails.fullyQualifiedName, serviceCategory]);

  const fetchCollateAgentsList = useCallback(
    async (paging?: Omit<Paging, 'total'>) => {
      try {
        setIsCollateAgentLoading(true);
        const { data, paging: pagingRes } = await getApplicationList({
          agentType: AgentType.CollateAI,
          ...paging,
        });

        setCollateAgentsList(data);
        handleCollateAgentPagingChange(pagingRes);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsCollateAgentLoading(false);
      }
    },
    [handleCollateAgentPagingChange]
  );

  const getAllIngestionWorkflows = useCallback(
    async (paging?: Omit<Paging, 'total'>, limit?: number) => {
      try {
        setIsIngestionPipelineLoading(true);
        const response = await getIngestionPipelines({
          arrQueryFields: [
            TabSpecificField.OWNERS,
            TabSpecificField.PIPELINE_STATUSES,
          ],
          serviceFilter: decodedServiceFQN,
          serviceType: getEntityTypeFromServiceCategory(serviceCategory),
          paging,
          pipelineType: SERVICE_INGESTION_PIPELINE_TYPES,
          limit,
        });

        if (response.data) {
          setIngestionPipelines(response.data);
          handleIngestionPagingChange(response.paging);
        } else {
          handleIngestionPagingChange({} as Paging);
        }
      } finally {
        setIsIngestionPipelineLoading(false);
      }
    },
    [
      decodedServiceFQN,
      serviceCategory,
      ingestionPaging,
      handleIngestionPagingChange,
    ]
  );

  const searchPipelines = useCallback(
    async (searchText: string, page?: number) => {
      try {
        setIsIngestionPipelineLoading(true);
        const typeFilterArray = isEmpty(typeFilter)
          ? SERVICE_INGESTION_PIPELINE_TYPES.map((type) => ({
              key: type,
              label: startCase(type),
            }))
          : typeFilter;
        const res = await searchQuery({
          pageNumber: page,
          pageSize: ingestionPageSize,
          searchIndex: SearchIndex.INGESTION_PIPELINE,
          query: `*${getEncodedFqn(
            escapeESReservedCharacters(searchText ?? '')
          )}*`,
          filters: `(${typeFilterArray
            .map(
              (type, index) =>
                `pipelineType:${type.key} ${
                  index < typeFilterArray.length - 1 ? 'OR' : ''
                }`
            )
            .join(' ')}) ${
            isEmpty(statusFilter)
              ? ''
              : `AND (${statusFilter
                  .map(
                    (type, index) =>
                      `pipelineStatuses.pipelineState:${type.key} ${
                        index < statusFilter.length - 1 ? 'OR' : ''
                      }`
                  )
                  .join(' ')})`
          }`,
          queryFilter: getServiceDisplayNameQueryFilter(
            getEntityName(serviceDetails)
          ),
        });
        const pipelines = res.hits.hits.map((hit) => hit._source);
        const total = res?.hits?.total.value ?? 0;

        setIngestionPipelines(pipelines);
        handleIngestionPagingChange({ total });
      } finally {
        setIsIngestionPipelineLoading(false);
      }
    },
    [
      ingestionPageSize,
      handleIngestionPagingChange,
      serviceDetails,
      typeFilter,
      statusFilter,
    ]
  );

  const include = useMemo(
    () => (showDeleted ? Include.Deleted : Include.NonDeleted),
    [showDeleted]
  );

  const fetchDatabases = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getDatabases(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.USAGE_SUMMARY}`,
        paging,
        include
      );

      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, include]
  );

  const fetchTopics = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getTopics(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS}`,
        paging,
        include
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, include]
  );

  const fetchDashboards = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getDashboards(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.USAGE_SUMMARY}`,
        paging,
        include
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, include]
  );

  // Fetch Data Model count to show it in tab label
  const fetchDashboardsDataModel = useCallback(
    async (params?: ListDataModelParams) => {
      try {
        setIsServiceLoading(true);
        const { paging: resPaging } = await getDataModels({
          service: decodedServiceFQN,
          fields: [
            TabSpecificField.OWNERS,
            TabSpecificField.TAGS,
            TabSpecificField.FOLLOWERS,
          ].join(','),
          include,
          ...params,
        });
        setDataModelPaging(resPaging);
      } catch (error) {
        showErrorToast(error as AxiosError);
        handlePagingChange(pagingObject);
      }
    },
    [decodedServiceFQN, include]
  );

  const fetchPipeLines = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getPipelines(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${TabSpecificField.STATE},${TabSpecificField.USAGE_SUMMARY}`,
        paging,
        include
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, include]
  );

  const fetchMlModal = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const { data, paging: resPaging } = await getMlModels(
        decodedServiceFQN,
        `${TabSpecificField.OWNERS},${TabSpecificField.TAGS}`,
        paging,
        include
      );
      setData(data);
      handlePagingChange(resPaging);
    },
    [decodedServiceFQN, include]
  );

  const fetchContainers = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getContainers({
        service: decodedServiceFQN,
        fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS].join(','),
        paging,
        root: true,
        include,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, include]
  );

  const fetchSearchIndexes = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getSearchIndexes({
        service: decodedServiceFQN,
        fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS].join(','),
        paging,
        root: true,
        include,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, include]
  );
  const fetchCollections = useCallback(
    async (paging?: PagingWithoutTotal) => {
      const response = await getApiCollections({
        service: decodedServiceFQN,
        fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS}`,
        paging,
        include,
      });

      setData(response.data);
      handlePagingChange(response.paging);
    },
    [decodedServiceFQN, include]
  );

  const getOtherDetails = useCallback(
    async (paging?: PagingWithoutTotal) => {
      try {
        setIsServiceLoading(true);
        const pagingParams = { ...paging, limit: pageSize };
        switch (serviceCategory) {
          case ServiceCategory.DATABASE_SERVICES: {
            await fetchDatabases(pagingParams);

            break;
          }
          case ServiceCategory.MESSAGING_SERVICES: {
            await fetchTopics(pagingParams);

            break;
          }
          case ServiceCategory.DASHBOARD_SERVICES: {
            await fetchDashboards(pagingParams);

            break;
          }
          case ServiceCategory.PIPELINE_SERVICES: {
            await fetchPipeLines(pagingParams);

            break;
          }
          case ServiceCategory.ML_MODEL_SERVICES: {
            await fetchMlModal(pagingParams);

            break;
          }
          case ServiceCategory.STORAGE_SERVICES: {
            await fetchContainers(pagingParams);

            break;
          }
          case ServiceCategory.SEARCH_SERVICES: {
            await fetchSearchIndexes(pagingParams);

            break;
          }
          case ServiceCategory.API_SERVICES: {
            await fetchCollections(pagingParams);

            break;
          }
          default:
            break;
        }
      } catch {
        setData([]);
        handlePagingChange(pagingObject);
      } finally {
        setIsServiceLoading(false);
      }
    },
    [
      serviceCategory,
      fetchDatabases,
      fetchTopics,
      fetchDashboards,
      fetchPipeLines,
      fetchMlModal,
      fetchContainers,
      fetchSearchIndexes,
      fetchCollections,
      pageSize,
    ]
  );

  const fetchServiceDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getServiceByFQN(
        serviceCategory,
        decodedServiceFQN,
        {
          fields: `${TabSpecificField.OWNERS},${TabSpecificField.TAGS},${
            isMetadataService ? '' : TabSpecificField.DATA_PRODUCTS
          },${isMetadataService ? '' : TabSpecificField.DOMAIN}`,
          include: Include.All,
        }
      );
      setServiceDetails(response);
      setConnectionDetails(response.connection?.config as DashboardConnection);
      // show deleted child entities if service is deleted
      setShowDeleted(response.deleted ?? false);
    } catch (error) {
      // Error
      if ((error as AxiosError)?.response?.status === ClientErrors.FORBIDDEN) {
        history.replace(ROUTES.FORBIDDEN);
      }
    } finally {
      setIsLoading(false);
    }
  }, [serviceCategory, decodedServiceFQN, isMetadataService]);

  const handleUpdateDisplayName = useCallback(
    async (data: EntityName) => {
      if (isEmpty(serviceDetails)) {
        return;
      }

      const updatedData: ServicesType = {
        ...serviceDetails,
        displayName: data.displayName,
      };
      const jsonPatch = compare(serviceDetails, updatedData);

      try {
        const response = await patchService(
          serviceCategory,
          serviceDetails.id,
          jsonPatch
        );
        setServiceDetails((pre) => ({
          ...pre,
          displayName: response.displayName,
        }));
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    },
    [serviceDetails, serviceCategory]
  );

  const handleDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (
        serviceDetails.description !== updatedHTML &&
        !isEmpty(serviceDetails)
      ) {
        const updatedData: ServicesType = {
          ...serviceDetails,
          description: updatedHTML,
        };

        const jsonPatch = compare(serviceDetails, updatedData);

        try {
          const response = await patchService(
            serviceCategory,
            serviceDetails.id,
            jsonPatch
          );
          setServiceDetails(response);
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      }
    },
    [serviceDetails, serviceCategory]
  );

  const handleUpdateOwner = useCallback(
    async (owners: ServicesType['owners']) => {
      const updatedData = {
        ...serviceDetails,
        owners,
      } as ServicesUpdateRequest;

      const jsonPatch = compare(serviceDetails, updatedData);
      try {
        const res = await patchService(
          serviceCategory,
          serviceDetails?.id ?? '',
          jsonPatch
        );
        setServiceDetails(res);
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          t('server.entity-updating-error', {
            entity: t('label.owner-lowercase-plural'),
          })
        );
      }
    },
    [serviceDetails, serviceCategory]
  );

  const saveUpdatedServiceData = useCallback(
    async (updatedData: ServicesType) => {
      try {
        let jsonPatch: Operation[] = [];
        if (serviceDetails) {
          jsonPatch = compare(serviceDetails, updatedData);
        }

        const response = await patchService(
          serviceCategory,
          serviceDetails.id ?? '',
          jsonPatch
        );

        setServiceDetails(response);
      } catch (err) {
        showErrorToast(err as AxiosError);
      }
    },
    [serviceDetails, serviceCategory]
  );

  const handleUpdateTier = useCallback(
    async (newTier?: Tag) => {
      const tierTag = updateTierTag(serviceDetails?.tags ?? [], newTier);
      const updatedServiceDetails = {
        ...serviceDetails,
        tags: tierTag,
      };

      return saveUpdatedServiceData(updatedServiceDetails);
    },
    [saveUpdatedServiceData, serviceDetails]
  );

  const afterDomainUpdateAction = useCallback((data) => {
    const updatedData = data as ServicesType;

    setServiceDetails((data) => ({
      ...(data ?? updatedData),
      version: updatedData.version,
    }));
  }, []);

  const onPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        getAllIngestionWorkflows(
          { [cursorType]: ingestionPaging[cursorType] },
          ingestionPageSize
        );

        handleIngestionPageChange(
          currentPage,
          {
            cursorType: cursorType,
            cursorValue: ingestionPaging[cursorType]!,
          },
          ingestionPageSize
        );
      } else if (!isEmpty(searchText)) {
        searchPipelines(searchText, currentPage);
        handleIngestionPageChange(currentPage);
      }
    },
    [
      ingestionPaging,
      searchText,
      ingestionPageSize,
      handleIngestionPageChange,
      searchPipelines,
      getAllIngestionWorkflows,
    ]
  );

  const onCollateAgentPageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        fetchCollateAgentsList({
          [cursorType]: collateAgentPaging[cursorType],
          limit: collateAgentPageSize,
        });

        handleCollateAgentPageChange(
          currentPage,
          {
            cursorType: cursorType,
            cursorValue: collateAgentPaging[cursorType]!,
          },
          collateAgentPageSize
        );
      }
    },
    [
      collateAgentPaging,
      collateAgentPageSize,
      handleCollateAgentPageChange,
      fetchCollateAgentsList,
    ]
  );

  const versionHandler = useCallback(() => {
    currentVersion &&
      history.push(
        getServiceVersionPath(
          serviceCategory,
          decodedServiceFQN,
          toString(currentVersion)
        )
      );
  }, [currentVersion, serviceCategory, decodedServiceFQN]);

  const entityType = useMemo(
    () => getEntityTypeFromServiceCategory(serviceCategory),
    [serviceCategory]
  );

  const pagingHandler = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        getOtherDetails({
          [cursorType]: paging[cursorType],
        });
      }
      handlePageChange(currentPage);
    },
    [paging, getOtherDetails, handlePageChange]
  );

  const handleToggleDelete = useCallback((version?: number) => {
    setServiceDetails((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        deleted: !prev?.deleted,
        ...(version ? { version } : {}),
      };
    });

    // toggle showDeleted to show the deleted child entities
    setShowDeleted((prev) => !prev);
  }, []);

  const afterDeleteAction = useCallback(
    (isSoftDelete?: boolean) => {
      if (!isSoftDelete) {
        removeAutoPilotStatus(serviceDetails.fullyQualifiedName ?? '');
        history.push(
          getSettingPath(
            GlobalSettingsMenuCategory.SERVICES,
            getServiceRouteFromServiceType(serviceCategory)
          )
        );
      }
    },
    [serviceCategory, serviceDetails.fullyQualifiedName]
  );

  const handleRestoreService = useCallback(async () => {
    try {
      const { version: newVersion } = await restoreService(
        serviceCategory,
        serviceDetails.id
      );
      showSuccessToast(
        t('message.restore-entities-success', {
          entity: t('label.service'),
        }),
        2000
      );
      handleToggleDelete(newVersion);
    } catch (error) {
      showErrorToast(
        error as AxiosError,
        t('message.restore-entities-error', {
          entity: t('label.service'),
        })
      );
    }
  }, [serviceCategory, serviceDetails, handleToggleDelete]);

  const isTestingDisabled = useMemo(
    () =>
      !servicePermission.EditAll ||
      (isMetadataService && decodedServiceFQN === OPEN_METADATA) ||
      isUndefined(connectionDetails),
    [
      servicePermission,
      serviceCategory,
      decodedServiceFQN,
      connectionDetails,
      isMetadataService,
    ]
  );

  const disableRunAgentsButton = useMemo(
    () =>
      workflowStatesData?.mainInstanceState.status &&
      ![WorkflowStatus.Exception, WorkflowStatus.Failure].includes(
        workflowStatesData?.mainInstanceState.status
      ),
    [workflowStatesData?.mainInstanceState.status]
  );

  useEffect(() => {
    handlePageChange(INITIAL_PAGING_VALUE);
    getOtherDetails({ limit: pageSize });
  }, [activeTab, showDeleted, deleted, pageSize]);

  useEffect(() => {
    // fetch count for data modal tab, its need only when its dashboard page and data modal tab is not active
    if (serviceCategory === ServiceCategory.DASHBOARD_SERVICES) {
      fetchDashboardsDataModel({ limit: 0 });
    }
  }, []);

  useEffect(() => {
    if (servicePermission.ViewAll || servicePermission.ViewBasic) {
      fetchServiceDetails();
    }
  }, [decodedServiceFQN, serviceCategory, servicePermission]);

  useEffect(() => {
    if (!isOpenMetadataService) {
      fetchServicePermission();
    }
  }, [decodedServiceFQN, serviceCategory]);

  useEffect(() => {
    if (isAirflowAvailable && !isOpenMetadataService) {
      isEmpty(searchText) && isEmpty(statusFilter) && isEmpty(typeFilter)
        ? getAllIngestionWorkflows(
            {},
            ingestionPagingCursor?.pageSize ?? ingestionPageSize
          )
        : searchPipelines(searchText, currentIngestionPage);
    }
  }, [
    isAirflowAvailable,
    searchText,
    ingestionPageSize,
    statusFilter,
    typeFilter,
  ]);

  useEffect(() => {
    if (isCollateAIWidgetSupported) {
      fetchCollateAgentsList({
        limit: collateAgentPagingCursor?.pageSize ?? collateAgentPageSize,
      });
    }
  }, [collateAgentPageSize]);

  useEffect(() => {
    fetchWorkflowInstanceStates();
  }, [serviceDetails.fullyQualifiedName]);

  const agentCounts = useMemo(() => {
    return {
      [ServiceAgentSubTabs.COLLATE_AI]: collateAgentPaging.total,
      [ServiceAgentSubTabs.METADATA]: ingestionPaging.total,
    };
  }, [collateAgentPaging, ingestionPaging]);

  const refreshAgentsList = useCallback(
    async (agentListType: ServiceAgentSubTabs) => {
      if (agentListType === ServiceAgentSubTabs.COLLATE_AI) {
        await fetchCollateAgentsList({
          limit: collateAgentPagingCursor?.pageSize ?? collateAgentPageSize,
        });
      } else {
        setSearchText('');
        await getAllIngestionWorkflows(
          {},
          ingestionPagingCursor?.pageSize ?? ingestionPageSize
        );
      }
    },
    [
      collateAgentPagingCursor,
      collateAgentPageSize,
      getAllIngestionWorkflows,
      ingestionPagingCursor,
      ingestionPageSize,
    ]
  );

  const ingestionTab = useMemo(
    () => (
      <Ingestion
        agentCounts={agentCounts}
        airflowInformation={airflowInformation}
        collateAgentPagingInfo={collateAgentPagingInfo}
        collateAgentsList={collateAgentsList}
        handleIngestionListUpdate={handleIngestionListUpdate}
        handleSearchChange={handleSearchChange}
        handleStatusFilterChange={handleStatusFilterChange}
        handleTypeFilterChange={handleTypeFilterChange}
        ingestionPagingInfo={ingestionPagingInfo}
        ingestionPipelineList={ingestionPipelines}
        isCollateAgentLoading={isCollateAgentLoading}
        isLoading={isIngestionPipelineLoading}
        refreshAgentsList={refreshAgentsList}
        searchText={searchText}
        serviceDetails={serviceDetails}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onCollateAgentPageChange={onCollateAgentPageChange}
        onIngestionWorkflowsUpdate={getAllIngestionWorkflows}
        onPageChange={onPageChange}
      />
    ),
    [
      airflowInformation,
      isIngestionPipelineLoading,
      serviceDetails,
      ingestionPipelines,
      ingestionPaging,
      getAllIngestionWorkflows,
      handleIngestionListUpdate,
      searchText,
      handleSearchChange,
      onPageChange,
      ingestionPagingInfo,
      collateAgentsList,
      isCollateAgentLoading,
      collateAgentPagingInfo,
      onCollateAgentPageChange,
      agentCounts,
      refreshAgentsList,
      handleStatusFilterChange,
      handleTypeFilterChange,
      statusFilter,
      typeFilter,
    ]
  );

  const extraInfoData = useMemo(() => {
    return serviceUtilClassBase.getServiceExtraInfo(serviceDetails);
  }, [serviceDetails]);

  const testConnectionTab = useMemo(() => {
    return (
      <div className="connection-tab-content">
        <div className="flex items-center justify-between">
          <AirflowMessageBanner />

          <Space className="w-full justify-end">
            <Tooltip
              title={
                servicePermission.EditAll
                  ? t('label.edit-entity', {
                      entity: t('label.connection'),
                    })
                  : t('message.no-permission-for-action')
              }>
              <Button
                ghost
                data-testid="edit-connection-button"
                disabled={!servicePermission.EditAll}
                type="primary"
                onClick={goToEditConnection}>
                {t('label.edit-entity', {
                  entity: t('label.connection'),
                })}
              </Button>
            </Tooltip>
            {allowTestConn && isAirflowAvailable && (
              <Tooltip
                title={
                  servicePermission.EditAll
                    ? t('label.test-entity', {
                        entity: t('label.connection'),
                      })
                    : t('message.no-permission-for-action')
                }>
                <TestConnection
                  connectionType={serviceDetails?.serviceType ?? ''}
                  getData={() => connectionDetails}
                  isTestingDisabled={isTestingDisabled}
                  serviceCategory={serviceCategory as ServiceCategory}
                  serviceName={serviceDetails?.name}
                  // validation is not required as we have all the data available and not in edit mode
                  shouldValidateForm={false}
                  showDetails={false}
                />
              </Tooltip>
            )}
          </Space>
        </div>

        <ServiceConnectionDetails
          connectionDetails={connectionDetails ?? {}}
          extraInfo={extraInfoData}
          serviceCategory={serviceCategory}
          serviceFQN={serviceDetails?.serviceType || ''}
        />
      </div>
    );
  }, [
    servicePermission.EditAll,
    allowTestConn,
    isAirflowAvailable,
    goToEditConnection,
    serviceDetails,
    connectionDetails,
    isTestingDisabled,
    serviceCategory,
    statusFilter,
    typeFilter,
    extraInfoData,
  ]);

  const tabs: TabsProps['items'] = useMemo(() => {
    const tabs = [];
    const ownerIds = serviceDetails?.owners?.map((owner) => owner.id) ?? [];
    const userOwnsService = ownerIds.includes(currentUser?.id ?? '');
    const userInOwnerTeam = Boolean(
      currentUser?.teams?.some((team) => ownerIds.includes(team.id))
    );

    const showIngestionTab = userInOwnerTeam || userOwnsService || isAdminUser;

    if (!isMetadataService) {
      tabs.push(
        {
          name: t('label.insight-plural'),
          key: EntityTabs.INSIGHTS,
          children: (
            <ServiceInsightsTab
              isWorkflowStatusLoading={isWorkflowStatusLoading}
              serviceDetails={serviceDetails}
              workflowStatesData={workflowStatesData}
            />
          ),
        },
        {
          name: getCountLabel(serviceCategory),
          key: getCountLabel(serviceCategory).toLowerCase(),
          count: paging.total,
          children: (
            <ServiceMainTabContent
              currentPage={currentPage}
              data={data}
              isServiceLoading={isServiceLoading}
              paging={paging}
              pagingHandler={pagingHandler}
              pagingInfo={pagingInfo}
              saveUpdatedServiceData={saveUpdatedServiceData}
              serviceDetails={serviceDetails}
              serviceName={serviceCategory}
              servicePermission={servicePermission}
              showDeleted={showDeleted}
              onDescriptionUpdate={handleDescriptionUpdate}
              onShowDeletedChange={handleShowDeleted}
            />
          ),
        }
      );
    }

    if (serviceCategory === ServiceCategory.DASHBOARD_SERVICES) {
      tabs.push({
        name: t('label.data-model'),
        key: EntityTabs.DATA_Model,
        count: dataModelPaging.total,
        children: <DataModelTable />,
      });
    }

    tabs.push(
      {
        name: t('label.agent-plural'),
        key: EntityTabs.AGENTS,
        isHidden: !showIngestionTab,
        count: ingestionPaging.total + collateAgentPaging.total,
        children: ingestionTab,
      },
      {
        name: t('label.connection'),
        isHidden: !servicePermission.EditAll,
        key: EntityTabs.CONNECTION,
        children: testConnectionTab,
      }
    );

    return tabs
      .filter((tab) => !tab.isHidden)
      .map((tab) => ({
        label: (
          <TabsLabel
            count={tab.count}
            id={tab.key}
            isActive={activeTab === tab.key}
            name={tab.name}
          />
        ),
        key: tab.key,
        children: tab.children,
      }));
  }, [
    currentUser,
    currentPage,
    pagingHandler,
    serviceDetails,
    isAdminUser,
    serviceCategory,
    paging,
    servicePermission,
    handleDescriptionUpdate,
    showDeleted,
    handleShowDeleted,
    data,
    isServiceLoading,
    getOtherDetails,
    saveUpdatedServiceData,
    dataModelPaging,
    ingestionPaging,
    collateAgentPaging,
    ingestionTab,
    testConnectionTab,
    activeTab,
    isMetadataService,
    workflowStatesData,
    isWorkflowStatusLoading,
  ]);

  const afterAutoPilotAppTrigger = useCallback(() => {
    removeAutoPilotStatus(serviceDetails.fullyQualifiedName ?? '');
    fetchWorkflowInstanceStates();
  }, [serviceDetails.fullyQualifiedName, fetchWorkflowInstanceStates]);

  useEffect(() => {
    serviceUtilClassBase.getExtraInfo();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  if (!(servicePermission.ViewAll || servicePermission.ViewBasic)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <PageLayoutV1
      className="service-details-page"
      pageTitle={t('label.entity-detail-plural', {
        entity: getEntityName(serviceDetails),
      })}>
      {isEmpty(serviceDetails) ? (
        <ErrorPlaceHolder className="m-0">
          {getEntityMissingError(serviceCategory as string, decodedServiceFQN)}
        </ErrorPlaceHolder>
      ) : (
        <Row data-testid="service-page" gutter={[0, 12]}>
          <Col span={24}>
            <DataAssetsHeader
              isRecursiveDelete
              afterDeleteAction={afterDeleteAction}
              afterDomainUpdateAction={afterDomainUpdateAction}
              afterTriggerAction={afterAutoPilotAppTrigger}
              dataAsset={serviceDetails}
              disableRunAgentsButton={disableRunAgentsButton}
              entityType={entityType}
              extraDropdownContent={extraDropdownContent}
              isAutoPilotWorkflowStatusLoading={isWorkflowStatusLoading}
              permissions={servicePermission}
              showDomain={!isMetadataService}
              onDisplayNameUpdate={handleUpdateDisplayName}
              onOwnerUpdate={handleUpdateOwner}
              onRestoreDataAsset={handleRestoreService}
              onTierUpdate={handleUpdateTier}
              onVersionClick={versionHandler}
            />
          </Col>

          <Col className="entity-details-page-tabs" span={24}>
            <Tabs
              activeKey={activeTab}
              className="tabs-new"
              data-testid="tabs"
              items={tabs}
              onChange={activeTabHandler}
            />
          </Col>
        </Row>
      )}
    </PageLayoutV1>
  );
};

export default ServiceDetailsPage;
