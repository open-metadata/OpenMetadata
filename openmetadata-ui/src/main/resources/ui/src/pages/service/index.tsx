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

import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import Description from 'components/common/description/Description';
import ManageButton from 'components/common/entityPageInfo/ManageButton/ManageButton';
import EntitySummaryDetails from 'components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from 'components/common/error-with-placeholder/ErrorPlaceHolderIngestion';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from 'components/common/TabsPane/TabsPane';
import TestConnection from 'components/common/TestConnection/TestConnection';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import DataModelTable from 'components/DataModels/DataModelsTable';
import { EntityHeader } from 'components/Entity/EntityHeader/EntityHeader.component';
import Ingestion from 'components/Ingestion/Ingestion.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import ServiceConnectionDetails from 'components/ServiceConnectionDetails/ServiceConnectionDetails.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityType } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { Container } from 'generated/entity/data/container';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { isEmpty, isNil, isUndefined, startCase, toLower } from 'lodash';
import {
  ExtraInfo,
  PagingWithoutTotal,
  ServicesUpdateRequest,
  ServiceTypes,
} from 'Models';
import React, { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getDashboards, getDataModels } from 'rest/dashboardAPI';
import { getDatabases } from 'rest/databaseAPI';
import {
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from 'rest/ingestionPipelineAPI';
import { fetchAirflowConfig } from 'rest/miscAPI';
import { getMlModels } from 'rest/mlModelAPI';
import { getPipelines } from 'rest/pipelineAPI';
import { getServiceByFQN, patchService } from 'rest/serviceAPI';
import { getContainers } from 'rest/storageAPI';
import { getTopics } from 'rest/topicsAPI';
import { getEntityName } from 'utils/EntityUtils';
import {
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  OPEN_METADATA,
  SERVICE_CATEGORY_TYPE,
} from '../../constants/Services.constant';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { OwnerType } from '../../enums/user.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Database } from '../../generated/entity/data/database';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Topic } from '../../generated/entity/data/topic';
import { DashboardConnection } from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../generated/type/paging';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEditConnectionPath, getSettingPath } from '../../utils/RouterUtils';
import {
  getCountLabel,
  getCurrentServiceTab,
  getDeleteEntityMessage,
  getResourceEntityFromServiceCategory,
  getServicePageTabs,
  getServiceRouteFromServiceType,
  servicePageTabs,
  serviceTypeLogo,
  setServiceSchemaCount,
  setServiceTableCount,
  shouldTestConnection,
} from '../../utils/ServiceUtils';
import { getEntityLink, getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ServicePageData =
  | Database
  | Topic
  | Dashboard
  | Mlmodel
  | Pipeline
  | Container
  | DashboardDataModel;

const tableComponent = {
  body: {
    row: ({ children }: { children: React.ReactNode }) => (
      <tr data-testid="row">{children}</tr>
    ),
  },
};

const ServicePage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();
  const { serviceFQN, serviceCategory, tab } = useParams<{
    serviceFQN: string;
    serviceCategory: ServiceTypes;
    tab: string;
  }>();

  const isOpenMetadataService = useMemo(
    () => serviceFQN === OPEN_METADATA,
    [serviceFQN]
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const history = useHistory();
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [data, setData] = useState<Array<ServicePageData>>([]);
  const [isLoading, setIsLoading] = useState(!isOpenMetadataService);
  const [isServiceLoading, setIsServiceLoading] = useState(true);
  const [dataModel, setDataModel] = useState<Array<ServicePageData>>([]);
  const [dataModelPaging, setDataModelPaging] = useState<Paging>(pagingObject);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [activeTab, setActiveTab] = useState(
    getCurrentServiceTab(tab, serviceCategory)
  );
  const [isError, setIsError] = useState(isOpenMetadataService);
  const [ingestions, setIngestions] = useState<IngestionPipeline[]>([]);
  const [serviceList] = useState<Array<DatabaseService>>([]);
  const [ingestionPaging, setIngestionPaging] = useState<Paging>({} as Paging);

  const [currentPage, setCurrentPage] = useState(1);
  const [dataModelCurrentPage, setDataModelCurrentPage] = useState(1);
  const [airflowEndpoint, setAirflowEndpoint] = useState<string>();
  const [connectionDetails, setConnectionDetails] = useState<ConfigData>();

  const [schemaCount, setSchemaCount] = useState<number>(0);
  const [tableCount, setTableCount] = useState<number>(0);

  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(serviceCategory);
  }, [serviceCategory]);

  const fetchServicePermission = async () => {
    setIsLoading(true);
    try {
      const response = await getEntityPermissionByFqn(
        getResourceEntityFromServiceCategory(serviceCategory),
        serviceFQN
      );
      setServicePermission(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = useMemo(
    () =>
      getServicePageTabs(
        serviceCategory,
        paging.total,
        ingestionPaging.total,
        servicePermission,
        dataModelPaging.total
      ),
    [
      serviceCategory,
      paging,
      ingestionPaging,
      servicePermission,
      dataModelPaging,
    ]
  );

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        serviceDetails?.owner?.type === 'team'
          ? getTeamAndUserDetailsPath(serviceDetails?.owner?.name || '')
          : serviceDetails?.owner?.name || '',
      placeholderText:
        serviceDetails?.owner?.displayName || serviceDetails?.owner?.name || '',
      isLink: serviceDetails?.owner?.type === 'team',
      openInNewTab: false,
      profileName:
        serviceDetails?.owner?.type === OwnerType.USER
          ? serviceDetails?.owner?.name
          : undefined,
    },
  ];

  const isTestingDisabled = useMemo(
    () =>
      !servicePermission.EditAll ||
      (serviceCategory === ServiceCategory.METADATA_SERVICES &&
        serviceFQN === OPEN_METADATA) ||
      isUndefined(connectionDetails),
    [servicePermission, serviceCategory, serviceFQN, connectionDetails]
  );

  const goToEditConnection = () => {
    history.push(
      getEditConnectionPath(serviceCategory || '', serviceFQN || '')
    );
  };

  const activeTabHandler = (tabValue: number) => {
    setActiveTab(tabValue);
    const currentTabIndex = tabValue - 1;
    if (
      servicePageTabs(getCountLabel(serviceCategory))[currentTabIndex].path !==
      tab
    ) {
      setActiveTab(
        getCurrentServiceTab(
          servicePageTabs(getCountLabel(serviceCategory))[currentTabIndex].path,
          serviceCategory
        )
      );
      history.push({
        pathname: getServiceDetailsPath(
          serviceFQN,
          serviceCategory,
          servicePageTabs(getCountLabel(serviceCategory))[currentTabIndex].path
        ),
      });
    }
  };

  const getAirflowEndpoint = () => {
    fetchAirflowConfig()
      .then((res) => {
        if (res.apiEndpoint) {
          setAirflowEndpoint(res.apiEndpoint);
        } else {
          setAirflowEndpoint('');

          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.airflow-config-plural'),
          })
        );
      });
  };

  const getAllIngestionWorkflows = (paging?: string) => {
    setIsLoading(true);
    getIngestionPipelines(['owner', 'pipelineStatuses'], serviceFQN, paging)
      .then((res) => {
        if (res.data) {
          setIngestions(res.data);
          setIngestionPaging(res.paging);
        } else {
          setIngestionPaging({} as Paging);
          showErrorToast(
            t('server.entity-fetch-error', {
              entity: t('label.ingestion-workflow-lowercase'),
            })
          );
        }
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          t('server.entity-fetch-error', {
            entity: t('label.ingestion-workflow-lowercase'),
          })
        );
      })
      .finally(() => {
        setIsLoading(false);
        if (!airflowEndpoint) {
          getAirflowEndpoint();
        }
      });
  };

  const updateCurrentSelectedIngestion = (
    id: string,
    data: IngestionPipeline | undefined,
    updateKey: keyof IngestionPipeline,
    isDeleted = false
  ) => {
    const rowIndex = ingestions.findIndex((row) => row.id === id);

    const updatedRow = !isUndefined(data)
      ? { ...ingestions[rowIndex], [updateKey]: data[updateKey] }
      : null;

    const updatedData = isDeleted
      ? ingestions.filter((_, index) => index !== rowIndex)
      : updatedRow
      ? Object.assign([...ingestions], { [rowIndex]: updatedRow })
      : [...ingestions];

    setIngestions(updatedData);
  };

  const triggerIngestionById = async (id: string, displayName: string) => {
    try {
      const data = await triggerIngestionPipelineById(id);

      updateCurrentSelectedIngestion(id, data, 'pipelineStatuses');
    } catch (err) {
      showErrorToast(
        t('server.ingestion-workflow-operation-error', {
          operation: t('label.triggering-lowercase'),
          displayName,
        })
      );
    } finally {
      setIsLoading(false);
    }
  };

  const deployIngestion = (id: string) => {
    return new Promise<void>((resolve, reject) => {
      return deployIngestionPipelineById(id)
        .then((res) => {
          if (res.data) {
            resolve();
            setTimeout(() => {
              updateCurrentSelectedIngestion(
                id,
                res.data,
                'fullyQualifiedName'
              );

              setIsLoading(false);
            }, 500);
          } else {
            throw t('server.entity-updating-error', {
              entity: t('label.ingestion-workflow-lowercase'),
            });
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            t('server.entity-updating-error', {
              entity: t('label.ingestion-workflow-lowercase'),
            })
          );
          reject();
        });
    });
  };

  const handleEnableDisableIngestion = (id: string) => {
    enableDisableIngestionPipelineById(id)
      .then((res) => {
        if (res.data) {
          updateCurrentSelectedIngestion(id, res.data, 'enabled');
        } else {
          throw t('server.unexpected-response');
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, t('server.unexpected-response'));
      });
  };

  const deleteIngestionById = (
    id: string,
    displayName: string
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      deleteIngestionPipelineById(id)
        .then(() => {
          resolve();
          setIngestions((ingestions) =>
            ingestions.filter((ing) => ing.id !== id)
          );
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            t('server.ingestion-workflow-operation-error', {
              operation: t('label.deleting-lowercase'),
              displayName,
            })
          );
          reject();
        });
    }).finally(() => setIsLoading(false));
  };

  const fetchDatabases = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getDatabases(
        serviceFQN,
        'owner,usageSummary',
        paging
      );

      setData(data);
      setServiceSchemaCount(data, setSchemaCount);
      setServiceTableCount(data, setTableCount);
      setPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchTopics = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getTopics(
        serviceFQN,
        'owner,tags',
        paging
      );
      setData(data);
      setPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchDashboards = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getDashboards(
        serviceFQN,
        'owner,usageSummary,tags',
        paging
      );
      setData(data);
      setPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchDashboardsDataModel = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getDataModels(
        serviceFQN,
        'owner,tags,followers',
        paging
      );
      setDataModel(data);
      setDataModelPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchPipeLines = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getPipelines(
        serviceFQN,
        'owner,tags',
        paging
      );
      setData(data);
      setPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchMlModal = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getMlModels(
        serviceFQN,
        'owner,tags',
        paging
      );
      setData(data);
      setPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchContainers = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const response = await getContainers({
        service: serviceFQN,
        fields: 'owner,tags',
        paging,
        root: true,
      });

      setData(response.data);
      setPaging(response.paging);
    } catch (error) {
      setData([]);
      setPaging(pagingObject);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const getOtherDetails = (
    paging?: PagingWithoutTotal,
    isDataModel?: boolean
  ) => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES: {
        fetchDatabases(paging);

        break;
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        fetchTopics(paging);

        break;
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        if (!isDataModel) {
          fetchDashboards(paging);
        }
        fetchDashboardsDataModel(paging);

        break;
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        fetchPipeLines(paging);

        break;
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        fetchMlModal(paging);

        break;
      }
      case ServiceCategory.STORAGE_SERVICES: {
        fetchContainers(paging);

        break;
      }
      default:
        break;
    }
  };

  const getLinkForFqn = (fqn: string) => {
    switch (serviceCategory) {
      case ServiceCategory.MESSAGING_SERVICES:
        return getEntityLink(SearchIndex.TOPIC, fqn);

      case ServiceCategory.DASHBOARD_SERVICES:
        return getEntityLink(SearchIndex.DASHBOARD, fqn);

      case ServiceCategory.PIPELINE_SERVICES:
        return getEntityLink(SearchIndex.PIPELINE, fqn);

      case ServiceCategory.ML_MODEL_SERVICES:
        return getEntityLink(SearchIndex.MLMODEL, fqn);

      case ServiceCategory.STORAGE_SERVICES:
        return getEntityLink(EntityType.CONTAINER, fqn);

      case ServiceCategory.DATABASE_SERVICES:
      default:
        return `/database/${fqn}`;
    }
  };

  const getOptionalTableCells = (data: ServicePageData) => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES: {
        const database = data as Database;

        return (
          <p>
            {getUsagePercentile(
              database?.usageSummary?.weeklyStats?.percentileRank || 0
            )}
          </p>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        const topic = data as Topic;

        return (
          <TagsViewer sizeCap={-1} tags={topic.tags ?? []} type="border" />
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboard = data as Dashboard;

        return (
          <TagsViewer sizeCap={-1} tags={dashboard.tags ?? []} type="border" />
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipeline = data as Pipeline;

        return (
          <TagsViewer sizeCap={-1} tags={pipeline.tags ?? []} type="border" />
        );
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        const mlmodal = data as Mlmodel;

        return (
          <TagsViewer sizeCap={-1} tags={mlmodal.tags ?? []} type="border" />
        );
      }
      case ServiceCategory.STORAGE_SERVICES: {
        const container = data as Container;

        return (
          <TagsViewer sizeCap={-1} tags={container.tags ?? []} type="border" />
        );
      }
      default:
        return <></>;
    }
  };

  useEffect(() => {
    if (servicePermission.ViewAll || servicePermission.ViewBasic) {
      setIsLoading(true);
      getServiceByFQN(serviceCategory, serviceFQN, 'owner')
        .then((resService) => {
          if (resService) {
            const { description } = resService;
            setServiceDetails(resService);
            setConnectionDetails(
              resService.connection?.config as DashboardConnection
            );
            setDescription(description ?? '');
            setSlashedTableName([
              {
                name: startCase(serviceCategory || ''),
                url: getSettingPath(
                  GlobalSettingsMenuCategory.SERVICES,
                  getServiceRouteFromServiceType(serviceCategory)
                ),
              },
            ]);
            getOtherDetails();
          } else {
            showErrorToast(
              t('server.entity-fetch-error', {
                entity: t('label.service-detail-lowercase-plural'),
              })
            );
          }
        })
        .catch((error: AxiosError) => {
          if (error.response?.status === 404) {
            setIsError(true);
          } else {
            showErrorToast(
              error,
              t('server.entity-fetch-error', {
                entity: t('label.service-detail-lowercase-plural'),
              })
            );
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [serviceFQN, serviceCategory, servicePermission]);

  useEffect(() => {
    if (servicePermission.ViewAll || servicePermission.ViewBasic) {
      const currentTab = getCurrentServiceTab(tab, serviceCategory);
      const currentTabIndex = currentTab - 1;

      if (tabs[currentTabIndex]?.isProtected) {
        activeTabHandler(1);
      }
    }
  }, [servicePermission]);

  const handleAfterDeleteAction = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.SERVICES,
        SERVICE_CATEGORY_TYPE[
          serviceCategory as keyof typeof SERVICE_CATEGORY_TYPE
        ]
      )
    );
  };
  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isUndefined(serviceDetails)) {
      return;
    }

    const { id } = serviceDetails;

    const updatedData: ServicesType = {
      ...serviceDetails,
      displayName: data.displayName,
    };
    const jsonPatch = compare(serviceDetails, updatedData);

    try {
      const response = await patchService(serviceCategory, id, jsonPatch);
      setServiceDetails((pre) => {
        if (isUndefined(pre)) {
          return;
        }

        return {
          ...pre,
          displayName: response.displayName,
        };
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && !isUndefined(serviceDetails)) {
      const { id } = serviceDetails;

      const updatedData: ServicesType = {
        ...serviceDetails,
        description: updatedHTML,
      };

      const jsonPatch = compare(serviceDetails, updatedData);

      try {
        const response = await patchService(serviceCategory, id, jsonPatch);
        setDescription(response.description ?? '');
        setServiceDetails(response);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsEdit(false);
      }
    } else {
      setIsEdit(false);
    }
  };

  const handleUpdateOwner = async (owner: ServicesType['owner']) => {
    const updatedData = {
      ...serviceDetails,
      owner,
    } as ServicesUpdateRequest;

    const jsonPatch = compare(serviceDetails || {}, updatedData);
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
          entity: t('label.owner-lowercase'),
        })
      );
    }
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const pagingHandler = (cursorType: string | number, activePage?: number) => {
    getOtherDetails({
      [cursorType]: paging[cursorType as keyof typeof paging],
    });
    setCurrentPage(activePage ?? 1);
  };

  const dataModelPagingHandler = (
    cursorType: string | number,
    activePage?: number
  ) => {
    getOtherDetails(
      {
        [cursorType]:
          dataModelPaging[cursorType as keyof typeof dataModelPaging],
      },
      true
    );

    setDataModelCurrentPage(activePage ?? 1);
  };

  const ingestionTab = useMemo(() => {
    if (!isAirflowAvailable) {
      return <ErrorPlaceHolderIngestion />;
    } else if (isUndefined(airflowEndpoint) || isUndefined(serviceDetails)) {
      return <Loader />;
    } else {
      return (
        <div data-testid="ingestion-container">
          <Ingestion
            isRequiredDetailsAvailable
            airflowEndpoint={airflowEndpoint}
            deleteIngestion={deleteIngestionById}
            deployIngestion={deployIngestion}
            handleEnableDisableIngestion={handleEnableDisableIngestion}
            ingestionList={ingestions}
            paging={ingestionPaging}
            permissions={servicePermission}
            serviceCategory={serviceCategory as ServiceCategory}
            serviceDetails={serviceDetails}
            serviceList={serviceList}
            serviceName={serviceFQN}
            triggerIngestion={triggerIngestionById}
            onIngestionWorkflowsUpdate={getAllIngestionWorkflows}
          />
        </div>
      );
    }
  }, [
    isAirflowAvailable,
    airflowEndpoint,
    serviceDetails,
    deleteIngestionById,
    deployIngestion,
    handleEnableDisableIngestion,
    ingestions,
    ingestionPaging,
    servicePermission,
    serviceCategory,
    serviceList,
    serviceFQN,
    triggerIngestionById,
    getAllIngestionWorkflows,
  ]);

  const dataModalTab = useMemo(
    () => (
      <DataModelTable
        currentPage={dataModelCurrentPage}
        data={dataModel}
        isLoading={isServiceLoading}
        paging={dataModelPaging}
        pagingHandler={dataModelPagingHandler}
      />
    ),
    [dataModel, isServiceLoading, dataModelPagingHandler, dataModelCurrentPage]
  );

  const testConnectionTab = useMemo(() => {
    return (
      <>
        <Space className="w-full my-4 justify-end">
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
                formData={connectionDetails as ConfigData}
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
        <ServiceConnectionDetails
          connectionDetails={connectionDetails || {}}
          serviceCategory={serviceCategory}
          serviceFQN={serviceDetails?.serviceType || ''}
        />
      </>
    );
  }, [
    servicePermission.EditAll,
    allowTestConn,
    isAirflowAvailable,
    serviceDetails,
    connectionDetails,
    isTestingDisabled,
    serviceCategory,
  ]);

  useEffect(() => {
    if (
      servicePageTabs(getCountLabel(serviceCategory))[activeTab - 1].path !==
      tab
    ) {
      setActiveTab(getCurrentServiceTab(tab, serviceCategory));
    }
  }, [tab]);

  useEffect(() => {
    if (!isOpenMetadataService) {
      fetchServicePermission();
    }
  }, [serviceFQN, serviceCategory]);

  const tableColumn: ColumnsType<ServicePageData> = useMemo(() => {
    const lastColumn =
      ServiceCategory.DATABASE_SERVICES === serviceCategory
        ? t('label.usage')
        : t('label.tag-plural');

    return [
      {
        title: t('label.name'),
        dataIndex: 'displayName',
        key: 'displayName',
        render: (_, record: ServicePageData) => {
          return (
            <Link to={getLinkForFqn(record.fullyQualifiedName || '')}>
              {getEntityName(record)}
            </Link>
          );
        },
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (description: ServicePageData['description']) =>
          !isUndefined(description) && description.trim() ? (
            <RichTextEditorPreviewer markdown={description} />
          ) : (
            <span className="text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </span>
          ),
      },
      {
        title: t('label.owner'),
        dataIndex: 'owner',
        key: 'owner',
        render: (owner: ServicePageData['owner']) =>
          !isUndefined(owner) ? (
            <Space data-testid="owner-data">
              <ProfilePicture
                id=""
                name={owner.name ?? ''}
                type="circle"
                width="24"
              />
              <Typography.Text data-testid={`${owner.name}-owner-name`}>
                {getEntityName(owner)}
              </Typography.Text>
            </Space>
          ) : (
            <Typography.Text data-testid="no-owner-text">--</Typography.Text>
          ),
      },
      {
        title: lastColumn,
        dataIndex: toLower(lastColumn),
        key: toLower(lastColumn),
        render: (_, record: ServicePageData) => (
          <div data-testid="record-tags">{getOptionalTableCells(record)}</div>
        ),
      },
    ];
  }, [serviceCategory]);

  const entityServiceTab = useMemo(() => {
    if (isServiceLoading) {
      return <Loader />;
    } else if (!isEmpty(data) && !isServiceLoading) {
      return (
        <div data-testid="table-container">
          <Table
            bordered
            className="mt-4 table-shadow"
            columns={tableColumn}
            components={tableComponent}
            data-testid="service-children-table"
            dataSource={data}
            pagination={false}
            rowKey="id"
            size="small"
          />
          {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              paging={paging}
              pagingHandler={pagingHandler}
              totalCount={paging.total}
            />
          )}
        </div>
      );
    } else {
      return <ErrorPlaceHolder />;
    }
  }, [
    isServiceLoading,
    data,
    paging,
    tableColumn,
    tableComponent,
    currentPage,
    pagingHandler,
  ]);

  useEffect(() => {
    if (isAirflowAvailable && !isOpenMetadataService) {
      getAllIngestionWorkflows();
    }
  }, [isAirflowAvailable]);

  if (isLoading) {
    return (
      <PageContainerV1>
        <Loader />
      </PageContainerV1>
    );
  }

  return (
    <PageContainerV1>
      {isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError(serviceCategory as string, serviceFQN)}
        </ErrorPlaceHolder>
      ) : (
        <PageLayoutV1
          pageTitle={t('label.entity-detail-plural', {
            entity: getEntityName(serviceDetails),
          })}>
          {servicePermission.ViewAll || servicePermission.ViewBasic ? (
            <Row data-testid="service-page">
              {serviceDetails && (
                <Row className="w-full m-b-xs" wrap={false}>
                  <Col flex="auto">
                    <EntityHeader
                      breadcrumb={slashedTableName}
                      entityData={serviceDetails}
                      icon={
                        <img
                          className="h-8"
                          src={serviceTypeLogo(serviceDetails.serviceType)}
                        />
                      }
                      serviceName={serviceDetails.name}
                    />
                  </Col>
                  <Col flex="30px">
                    <ManageButton
                      isRecursiveDelete
                      afterDeleteAction={handleAfterDeleteAction}
                      allowSoftDelete={false}
                      canDelete={servicePermission.Delete}
                      deleteMessage={getDeleteEntityMessage(
                        serviceCategory || '',
                        paging.total,
                        schemaCount,
                        tableCount
                      )}
                      displayName={serviceDetails.displayName}
                      editDisplayNamePermission={
                        servicePermission.EditAll ||
                        servicePermission.EditDisplayName
                      }
                      entityFQN={serviceFQN}
                      entityId={serviceDetails.id}
                      entityName={serviceDetails.name}
                      entityType={serviceCategory?.slice(0, -1)}
                      onEditDisplayName={handleUpdateDisplayName}
                    />
                  </Col>
                </Row>
              )}

              <Col span={24}>
                <Space>
                  {extraInfo.map((info) => (
                    <Space data-testid={info.key} key={info.id}>
                      <EntitySummaryDetails
                        currentOwner={serviceDetails?.owner}
                        data={info}
                        updateOwner={
                          servicePermission.EditAll ||
                          servicePermission.EditOwner
                            ? handleUpdateOwner
                            : undefined
                        }
                      />
                    </Space>
                  ))}
                </Space>
              </Col>
              <Col data-testid="description-container" span={24}>
                <Description
                  description={description || ''}
                  entityFqn={serviceFQN}
                  entityName={serviceFQN}
                  entityType={serviceCategory.slice(0, -1)}
                  hasEditAccess={
                    servicePermission.EditAll ||
                    servicePermission.EditDescription
                  }
                  isEdit={isEdit}
                  onCancel={onCancel}
                  onDescriptionEdit={onDescriptionEdit}
                  onDescriptionUpdate={onDescriptionUpdate}
                />
              </Col>
              <Col span={24}>
                <TabsPane
                  activeTab={activeTab}
                  className="flex-initial"
                  setActiveTab={activeTabHandler}
                  tabs={tabs}
                />
                <Col span={24}>
                  {activeTab === 1 && entityServiceTab}
                  {activeTab === 4 && dataModalTab}
                  {activeTab === 2 && ingestionTab}
                  {activeTab === 3 && testConnectionTab}
                </Col>
              </Col>
            </Row>
          ) : (
            <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />
          )}
        </PageLayoutV1>
      )}
    </PageContainerV1>
  );
};

export default ServicePage;
