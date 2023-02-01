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
import DeleteWidgetModal from 'components/common/DeleteWidget/DeleteWidgetModal';
import Description from 'components/common/description/Description';
import EntitySummaryDetails from 'components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from 'components/common/error-with-placeholder/ErrorPlaceHolderIngestion';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from 'components/common/TabsPane/TabsPane';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Ingestion from 'components/Ingestion/Ingestion.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import ServiceConnectionDetails from 'components/ServiceConnectionDetails/ServiceConnectionDetails.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { t } from 'i18next';
import { isEmpty, isNil, isUndefined, startCase, toLower } from 'lodash';
import { ExtraInfo, ServicesUpdateRequest, ServiceTypes } from 'Models';
import React, { FunctionComponent, useEffect, useMemo, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getDashboards } from 'rest/dashboardAPI';
import { getDatabases } from 'rest/databaseAPI';
import {
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from 'rest/ingestionPipelineAPI';
import { fetchAirflowConfig } from 'rest/miscAPI';
import { getMlmodels } from 'rest/mlModelAPI';
import { getPipelines } from 'rest/pipelineAPI';
import {
  getServiceByFQN,
  TestConnection,
  updateService,
} from 'rest/serviceAPI';
import { getTopics } from 'rest/topicsAPI';
import {
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { CONNECTORS_DOCS } from '../../constants/docs.constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  OPENMETADATA,
  servicesDisplayName,
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
import { MetadataServiceType } from '../../generated/entity/services/metadataService';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { useAirflowStatus } from '../../hooks/useAirflowStatus';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityMissingError, getEntityName } from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEditConnectionPath, getSettingPath } from '../../utils/RouterUtils';
import {
  getCountLabel,
  getCurrentServiceTab,
  getDeleteEntityMessage,
  getResourceEntityFromServiceCategory,
  getServiceCategoryFromType,
  getServicePageTabs,
  getServiceRouteFromServiceType,
  getTestConnectionType,
  servicePageTabs,
  serviceTypeLogo,
  setServiceSchemaCount,
  setServiceTableCount,
  shouldTestConnection,
} from '../../utils/ServiceUtils';
import { IcDeleteColored } from '../../utils/SvgUtils';
import { getEntityLink, getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

export type ServicePageData = Database | Topic | Dashboard | Mlmodel | Pipeline;

const ServicePage: FunctionComponent = () => {
  const { isAirflowAvailable } = useAirflowStatus();
  const { serviceFQN, serviceType, serviceCategory, tab } =
    useParams() as Record<string, string>;
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const history = useHistory();
  const [serviceName, setServiceName] = useState<ServiceTypes>(
    (serviceCategory as ServiceTypes) || getServiceCategoryFromType(serviceType)
  );
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceDetails, setServiceDetails] = useState<ServicesType>();
  const [data, setData] = useState<Array<ServicePageData>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [instanceCount, setInstanceCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState(
    getCurrentServiceTab(tab, serviceName)
  );
  const [isError, setIsError] = useState(false);
  const [ingestions, setIngestions] = useState<IngestionPipeline[]>([]);
  const [serviceList] = useState<Array<DatabaseService>>([]);
  const [ingestionPaging, setIngestionPaging] = useState<Paging>({} as Paging);

  const [currentPage, setCurrentPage] = useState(1);
  const [ingestionCurrentPage, setIngestionCurrentPage] = useState(1);
  const [airflowEndpoint, setAirflowEndpoint] = useState<string>();
  const [connectionDetails, setConnectionDetails] = useState<ConfigData>();

  const [schemaCount, setSchemaCount] = useState<number>(0);
  const [tableCount, setTableCount] = useState<number>(0);

  const [deleteWidgetVisible, setDeleteWidgetVisible] = useState(false);
  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const [isTestingConnection, setIsTestingConnection] =
    useState<boolean>(false);

  const allowTestConn = useMemo(() => {
    return shouldTestConnection(serviceType);
  }, [serviceType]);

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
        serviceName,
        instanceCount,
        ingestions,
        servicePermission
      ),
    [serviceName, instanceCount, ingestions, servicePermission]
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

  const activeTabHandler = (tabValue: number) => {
    setActiveTab(tabValue);
    const currentTabIndex = tabValue - 1;
    if (
      servicePageTabs(getCountLabel(serviceName))[currentTabIndex].path !== tab
    ) {
      setActiveTab(
        getCurrentServiceTab(
          servicePageTabs(getCountLabel(serviceName))[currentTabIndex].path,
          serviceName
        )
      );
      history.push({
        pathname: getServiceDetailsPath(
          serviceFQN,
          serviceCategory,
          servicePageTabs(getCountLabel(serviceName))[currentTabIndex].path
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

          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-airflow-config-error']
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
            jsonData['api-error-messages']['fetch-ingestion-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        showErrorToast(
          error,
          jsonData['api-error-messages']['fetch-ingestion-error']
        );
      })
      .finally(() => {
        setIsLoading(false);
        if (!airflowEndpoint) {
          getAirflowEndpoint();
        }
      });
  };

  const triggerIngestionById = (
    id: string,
    displayName: string
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      triggerIngestionPipelineById(id)
        .then((res) => {
          if (res.data) {
            resolve();
            getAllIngestionWorkflows();
          } else {
            reject();
            showErrorToast(
              `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`
            );
          }
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`
          );
          reject();
        })
        .finally(() => setIsLoading(false));
    });
  };

  const deployIngestion = (id: string) => {
    return new Promise<void>((resolve, reject) => {
      return deployIngestionPipelineById(id)
        .then((res) => {
          if (res.data) {
            resolve();
            setTimeout(() => {
              getAllIngestionWorkflows();
              setIsLoading(false);
            }, 500);
          } else {
            throw jsonData['api-error-messages']['update-ingestion-error'];
          }
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['update-ingestion-error']
          );
          reject();
        });
    });
  };

  const handleEnableDisableIngestion = (id: string) => {
    enableDisableIngestionPipelineById(id)
      .then((res) => {
        if (res.data) {
          getAllIngestionWorkflows();
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['unexpected-server-response']
        );
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
          getAllIngestionWorkflows();
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            `${jsonData['api-error-messages']['delete-ingestion-error']} ${displayName}`
          );
          reject();
        });
    }).finally(() => setIsLoading(false));
  };

  const fetchDatabases = (paging?: string) => {
    setIsLoading(true);
    getDatabases(serviceFQN, ['owner', 'usageSummary'], paging)
      .then((res) => {
        if (res) {
          setData(res.data as Database[]);
          setServiceSchemaCount(res.data, setSchemaCount);
          setServiceTableCount(res.data, setTableCount);
          setPaging(res.paging);
          setInstanceCount(res.paging.total);
          setIsLoading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  const fetchTopics = (paging?: string) => {
    setIsLoading(true);
    getTopics(serviceFQN, ['owner', 'tags'], paging)
      .then((res) => {
        if (res.data) {
          setData(res.data);
          setPaging(res.paging);
          setInstanceCount(res.paging.total);
          setIsLoading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  const fetchDashboards = (paging?: string) => {
    setIsLoading(true);
    getDashboards(serviceFQN, ['owner', 'usageSummary', 'tags'], paging)
      .then((res) => {
        if (res.data) {
          setData(res.data);
          setPaging(res.paging);
          setInstanceCount(res.paging.total);
          setIsLoading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  const fetchPipeLines = (paging?: string) => {
    setIsLoading(true);
    getPipelines(serviceFQN, ['owner', 'tags'], paging)
      .then((res) => {
        if (res.data) {
          setData(res.data);
          setPaging(res.paging);
          setInstanceCount(res.paging.total);
          setIsLoading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  const fetchMlModal = (paging = '') => {
    setIsLoading(true);
    getMlmodels(serviceFQN, paging, ['owner', 'tags'])
      .then((res) => {
        if (res.data) {
          setData(res.data);
          setPaging(res.paging);
          setInstanceCount(res.paging.total);
          setIsLoading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setIsLoading(false);
      });
  };

  const getOtherDetails = (paging?: string) => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        fetchDatabases(paging);

        break;
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        fetchTopics(paging);

        break;
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        fetchDashboards(paging);

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
      default:
        break;
    }
  };

  const getLinkForFqn = (fqn: string) => {
    switch (serviceName) {
      case ServiceCategory.MESSAGING_SERVICES:
        return getEntityLink(SearchIndex.TOPIC, fqn);

      case ServiceCategory.DASHBOARD_SERVICES:
        return getEntityLink(SearchIndex.DASHBOARD, fqn);

      case ServiceCategory.PIPELINE_SERVICES:
        return getEntityLink(SearchIndex.PIPELINE, fqn);

      case ServiceCategory.ML_MODEL_SERVICES:
        return getEntityLink(SearchIndex.MLMODEL, fqn);

      case ServiceCategory.DATABASE_SERVICES:
      default:
        return `/database/${fqn}`;
    }
  };

  const getOptionalTableCells = (data: ServicePageData) => {
    switch (serviceName) {
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

        return topic.tags && topic.tags?.length > 0 ? (
          <TagsViewer
            showStartWith={false}
            sizeCap={-1}
            tags={topic.tags}
            type="border"
          />
        ) : (
          '--'
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboard = data as Dashboard;

        return dashboard.tags && dashboard.tags?.length > 0 ? (
          <TagsViewer
            showStartWith={false}
            sizeCap={-1}
            tags={dashboard.tags}
            type="border"
          />
        ) : (
          '--'
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipeline = data as Pipeline;

        return pipeline.tags && pipeline.tags?.length > 0 ? (
          <TagsViewer
            showStartWith={false}
            sizeCap={-1}
            tags={pipeline.tags}
            type="border"
          />
        ) : (
          '--'
        );
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        const mlmodal = data as Mlmodel;

        return mlmodal.tags && mlmodal.tags?.length > 0 ? (
          <TagsViewer
            showStartWith={false}
            sizeCap={-1}
            tags={mlmodal.tags}
            type="border"
          />
        ) : (
          '--'
        );
      }
      default:
        return <></>;
    }
  };

  const checkTestConnect = async () => {
    if (connectionDetails) {
      setIsTestingConnection(true);
      try {
        const response = await TestConnection(
          connectionDetails,
          getTestConnectionType(serviceCategory as ServiceCategory)
        );
        // This api only responds with status 200 on success
        // No data sent on api success
        if (response.status === 200) {
          showSuccessToast(
            jsonData['api-success-messages']['test-connection-success']
          );
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      } catch (error) {
        showErrorToast(
          error as AxiosError,
          jsonData['api-error-messages']['test-connection-error']
        );
      } finally {
        setIsTestingConnection(false);
      }
    }
  };

  useEffect(() => {
    setServiceName(
      (serviceCategory as ServiceTypes) ||
        getServiceCategoryFromType(serviceType)
    );
  }, [serviceCategory, serviceType]);

  useEffect(() => {
    if (servicePermission.ViewAll || servicePermission.ViewBasic) {
      setIsLoading(true);
      getServiceByFQN(serviceName, serviceFQN, 'owner')
        .then((resService) => {
          if (resService) {
            const { description, serviceType } = resService;
            setServiceDetails(resService);
            setConnectionDetails(
              resService.connection?.config as DashboardConnection
            );
            setDescription(description ?? '');
            setSlashedTableName([
              {
                name: startCase(serviceName || ''),
                url: getSettingPath(
                  GlobalSettingsMenuCategory.SERVICES,
                  getServiceRouteFromServiceType(serviceName)
                ),
              },
              {
                name: getEntityName(resService),
                url: '',
                imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
                activeTitle: true,
              },
            ]);
            getOtherDetails();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['fetch-service-error']
            );
          }
        })
        .catch((error: AxiosError) => {
          if (error.response?.status === 404) {
            setIsError(true);
          } else {
            showErrorToast(
              error,
              jsonData['api-error-messages']['fetch-service-error']
            );
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [serviceFQN, serviceName, servicePermission, serviceType]);

  useEffect(() => {
    if (servicePermission.ViewAll || servicePermission.ViewBasic) {
      const currentTab = getCurrentServiceTab(tab, serviceName);
      const currentTabIndex = currentTab - 1;

      if (tabs[currentTabIndex]?.isProtected) {
        activeTabHandler(1);
      }
    }
  }, [servicePermission]);

  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && !isUndefined(serviceDetails)) {
      const { id } = serviceDetails;

      const updatedServiceDetails = {
        connection: serviceDetails?.connection,
        name: serviceDetails.name,
        serviceType: serviceDetails.serviceType,
        description: updatedHTML,
        owner: serviceDetails.owner,
      } as ServicesUpdateRequest;

      try {
        const response = await updateService(
          serviceName,
          id,
          updatedServiceDetails
        );
        setDescription(updatedHTML);
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

  const handleUpdateOwner = (owner: ServicesType['owner']) => {
    const updatedData = {
      connection: serviceDetails?.connection,
      name: serviceDetails?.name,
      serviceType: serviceDetails?.serviceType,
      owner,
      description: serviceDetails?.description,
    } as ServicesUpdateRequest;

    return new Promise<void>((resolve, reject) => {
      updateService(serviceName, serviceDetails?.id ?? '', updatedData)
        .then((res) => {
          if (res) {
            setServiceDetails(res);

            return resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['update-owner-error']
            );
          }

          return reject();
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-owner-error']
          );

          return reject();
        });
    });
  };

  const handleRemoveOwner = () => {
    const updatedData = {
      ...serviceDetails,
      owner: undefined,
    } as ServicesUpdateRequest;

    return new Promise<void>((resolve, reject) => {
      updateService(serviceName, serviceDetails?.id ?? '', updatedData)
        .then((res) => {
          if (res) {
            setServiceDetails(res);

            resolve();
          } else {
            showErrorToast(
              jsonData['api-error-messages']['update-owner-error']
            );
          }

          reject();
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-owner-error']
          );

          reject();
        });
    });
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const pagingHandler = (cursorType: string | number, activePage?: number) => {
    const pagingString = `&${cursorType}=${
      paging[cursorType as keyof typeof paging]
    }`;
    getOtherDetails(pagingString);
    setCurrentPage(activePage ?? 1);
  };

  const ingestionPagingHandler = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `&${cursorType}=${
      ingestionPaging[cursorType as keyof typeof paging]
    }`;

    getAllIngestionWorkflows(pagingString);
    setIngestionCurrentPage(activePage ?? 1);
  };

  const getIngestionTab = () => {
    if (!isAirflowAvailable) {
      return <ErrorPlaceHolderIngestion />;
    } else if (isUndefined(airflowEndpoint)) {
      return <Loader />;
    } else {
      return (
        <div data-testid="ingestion-container">
          <Ingestion
            isRequiredDetailsAvailable
            airflowEndpoint={airflowEndpoint}
            currrentPage={ingestionCurrentPage}
            deleteIngestion={deleteIngestionById}
            deployIngestion={deployIngestion}
            handleEnableDisableIngestion={handleEnableDisableIngestion}
            ingestionList={ingestions}
            paging={ingestionPaging}
            pagingHandler={ingestionPagingHandler}
            permissions={servicePermission}
            serviceCategory={serviceName as ServiceCategory}
            serviceDetails={serviceDetails as ServicesType}
            serviceList={serviceList}
            serviceName={serviceFQN}
            triggerIngestion={triggerIngestionById}
            onIngestionWorkflowsUpdate={getAllIngestionWorkflows}
          />
        </div>
      );
    }
  };

  useEffect(() => {
    if (
      servicePageTabs(getCountLabel(serviceName))[activeTab - 1].path !== tab
    ) {
      setActiveTab(getCurrentServiceTab(tab, serviceName));
    }
  }, [tab]);

  const goToEditConnection = () => {
    history.push(getEditConnectionPath(serviceName || '', serviceFQN || ''));
  };

  const handleEditConnection = () => {
    goToEditConnection();
  };

  const handleDelete = () => {
    setDeleteWidgetVisible(true);
  };

  useEffect(() => {
    fetchServicePermission();
  }, [serviceFQN, serviceCategory]);

  const getColumnDetails = (serviceName: ServiceTypes) => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        return [t('label.database-name'), t('label.usage')];
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return [t('label.topic-name'), t('label.tag-plural')];
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        return [t('label.dashboard-name'), t('label.tag-plural')];
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        return [t('label.pipeline-name'), t('label.tag-plural')];
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        return [t('label.model-name'), t('label.tag-plural')];
      }
      default:
        return [];
    }
  };

  const tableColumn: ColumnsType<ServicePageData> = useMemo(() => {
    const [firstColumn, lastColumn] = getColumnDetails(serviceName);

    return [
      {
        title: firstColumn,
        dataIndex: 'displayName',
        key: 'displayName',
        render: (text: string, record: ServicePageData) => {
          return (
            <Link to={getLinkForFqn(record.fullyQualifiedName || '')}>
              {isUndefined(text)
                ? getEntityName(record as unknown as EntityReference)
                : text}
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
  }, []);

  useEffect(() => {
    if (isAirflowAvailable) {
      getAllIngestionWorkflows();
    }
  }, [isAirflowAvailable]);

  return (
    <PageContainerV1>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError(serviceName as string, serviceFQN)}
        </ErrorPlaceHolder>
      ) : (
        <>
          {servicePermission.ViewAll || servicePermission.ViewBasic ? (
            <Row
              className="p-x-md p-t-lg"
              data-testid="service-page"
              gutter={[0, 12]}>
              <Col span={24}>
                <Space align="center" className="justify-between w-full">
                  <TitleBreadcrumb titleLinks={slashedTableName} />
                  {serviceDetails?.serviceType !==
                    MetadataServiceType.OpenMetadata && (
                    <Tooltip
                      placement="topRight"
                      title={
                        !servicePermission.Delete &&
                        t('message.no-permission-for-action')
                      }>
                      <Button
                        ghost
                        data-testid="service-delete"
                        disabled={!servicePermission.Delete}
                        icon={
                          <IcDeleteColored
                            className="anticon"
                            height={14}
                            viewBox="0 0 24 24"
                            width={14}
                          />
                        }
                        size="small"
                        type="primary"
                        onClick={handleDelete}>
                        {t('label.delete')}
                      </Button>
                    </Tooltip>
                  )}
                  <DeleteWidgetModal
                    isRecursiveDelete
                    afterDeleteAction={() =>
                      history.push(
                        getSettingPath(
                          GlobalSettingsMenuCategory.SERVICES,
                          SERVICE_CATEGORY_TYPE[
                            serviceCategory as keyof typeof SERVICE_CATEGORY_TYPE
                          ]
                        )
                      )
                    }
                    allowSoftDelete={false}
                    deleteMessage={getDeleteEntityMessage(
                      serviceName || '',
                      instanceCount,
                      schemaCount,
                      tableCount
                    )}
                    entityId={serviceDetails?.id}
                    entityName={serviceDetails?.name || ''}
                    entityType={serviceName?.slice(0, -1)}
                    visible={deleteWidgetVisible}
                    onCancel={() => setDeleteWidgetVisible(false)}
                  />
                </Space>
              </Col>
              <Col span={24}>
                <Space>
                  {extraInfo.map((info, index) => (
                    <Space key={index}>
                      <EntitySummaryDetails
                        currentOwner={serviceDetails?.owner}
                        data={info}
                        removeOwner={
                          servicePermission.EditAll ||
                          servicePermission.EditOwner
                            ? handleRemoveOwner
                            : undefined
                        }
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
                  {activeTab === 1 &&
                    (isEmpty(data) ? (
                      <ErrorPlaceHolder
                        doc={CONNECTORS_DOCS}
                        heading={servicesDisplayName[serviceName]}
                      />
                    ) : (
                      <div data-testid="table-container">
                        <Table
                          bordered
                          className="mt-4 table-shadow"
                          columns={tableColumn}
                          components={{
                            body: {
                              row: ({
                                children,
                              }: {
                                children: React.ReactNode;
                              }) => <tr data-testid="row">{children}</tr>,
                            },
                          }}
                          data-testid="service-children-table"
                          dataSource={data}
                          loading={{
                            spinning: isLoading,
                            indicator: <Loader size="small" />,
                          }}
                          pagination={false}
                          rowKey="id"
                          size="small"
                        />
                        {Boolean(
                          !isNil(paging.after) || !isNil(paging.before)
                        ) && (
                          <NextPrevious
                            currentPage={currentPage}
                            pageSize={PAGE_SIZE}
                            paging={paging}
                            pagingHandler={pagingHandler}
                            totalCount={paging.total}
                          />
                        )}
                      </div>
                    ))}

                  {activeTab === 2 && getIngestionTab()}

                  {activeTab === 3 && (
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
                            onClick={handleEditConnection}>
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
                            <Button
                              data-testid="test-connection-button"
                              disabled={
                                !servicePermission.EditAll ||
                                isTestingConnection ||
                                (serviceCategory ===
                                  ServiceCategory.METADATA_SERVICES &&
                                  serviceFQN === OPENMETADATA)
                              }
                              loading={isTestingConnection}
                              type="primary"
                              onClick={checkTestConnect}>
                              {t('label.test-entity', {
                                entity: t('label.connection'),
                              })}
                            </Button>
                          </Tooltip>
                        )}
                      </Space>
                      <ServiceConnectionDetails
                        connectionDetails={connectionDetails || {}}
                        serviceCategory={serviceCategory}
                        serviceFQN={serviceDetails?.serviceType || ''}
                      />
                    </>
                  )}
                </Col>
              </Col>
            </Row>
          ) : (
            <ErrorPlaceHolder>
              {t('message.no-permission-to-view')}
            </ErrorPlaceHolder>
          )}
        </>
      )}
    </PageContainerV1>
  );
};

export default ServicePage;
