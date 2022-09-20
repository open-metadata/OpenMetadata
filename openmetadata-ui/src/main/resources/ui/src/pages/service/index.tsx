/*
 *  Copyright 2021 Collate
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

import { Col, Row, Space, Tooltip } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { isEmpty, isNil, isUndefined, startCase } from 'lodash';
import { ExtraInfo, ServiceOption, ServiceTypes } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { getDashboards } from '../../axiosAPIs/dashboardAPI';
import { getDatabases } from '../../axiosAPIs/databaseAPI';
import {
  checkAirflowStatus,
  deleteIngestionPipelineById,
  deployIngestionPipelineById,
  enableDisableIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
} from '../../axiosAPIs/ingestionPipelineAPI';
import { fetchAirflowConfig } from '../../axiosAPIs/miscAPI';
import { getMlmodels } from '../../axiosAPIs/mlModelAPI';
import { getPipelines } from '../../axiosAPIs/pipelineAPI';
import { getServiceByFQN, updateService } from '../../axiosAPIs/serviceAPI';
import { getTopics } from '../../axiosAPIs/topicsAPI';
import { Button } from '../../components/buttons/Button/Button';
import DeleteWidgetModal from '../../components/common/DeleteWidget/DeleteWidgetModal';
import Description from '../../components/common/description/Description';
import EntitySummaryDetails from '../../components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from '../../components/common/error-with-placeholder/ErrorPlaceHolderIngestion';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import { OperationPermission } from '../../components/PermissionProvider/PermissionProvider.interface';
import ServiceConnectionDetails from '../../components/ServiceConnectionDetails/ServiceConnectionDetails.component';
import TagsViewer from '../../components/tags-viewer/tags-viewer';
import {
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { CONNECTORS_DOCS } from '../../constants/docs.constants';
import { GlobalSettingsMenuCategory } from '../../constants/globalSettings.constants';
import {
  NO_PERMISSION_FOR_ACTION,
  NO_PERMISSION_TO_VIEW,
} from '../../constants/HelperTextUtil';
import { servicesDisplayName } from '../../constants/services.const';
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
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import {
  getEntityMissingError,
  getEntityName,
  isEven,
} from '../../utils/CommonUtils';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import { getEditConnectionPath, getSettingPath } from '../../utils/RouterUtils';
import {
  getCurrentServiceTab,
  getDeleteEntityMessage,
  getResourceEntityFromServiceCategory,
  getServiceCategoryFromType,
  getServiceRouteFromServiceType,
  servicePageTabs,
  serviceTypeLogo,
  setServiceSchemaCount,
  setServiceTableCount,
} from '../../utils/ServiceUtils';
import { IcDeleteColored } from '../../utils/SvgUtils';
import { getEntityLink, getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ServicePageData = Database | Topic | Dashboard;

const ServicePage: FunctionComponent = () => {
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
  const [activeTab, setActiveTab] = useState(getCurrentServiceTab(tab));
  const [isError, setIsError] = useState(false);
  const [ingestions, setIngestions] = useState<IngestionPipeline[]>([]);
  const [serviceList] = useState<Array<DatabaseService>>([]);
  const [ingestionPaging, setIngestionPaging] = useState<Paging>({} as Paging);

  const [currentPage, setCurrentPage] = useState(1);
  const [ingestionCurrentPage, setIngestionCurrentPage] = useState(1);
  const [airflowEndpoint, setAirflowEndpoint] = useState<string>();
  const [isAirflowRunning, setIsAirflowRunning] = useState(false);
  const [connectionDetails, setConnectionDetails] = useState<ConfigData>();

  const [schemaCount, setSchemaCount] = useState<number>(0);
  const [tableCount, setTableCount] = useState<number>(0);

  const [deleteWidgetVisible, setDeleteWidgetVisible] = useState(false);
  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

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

  const getCountLabel = () => {
    switch (serviceName) {
      case ServiceCategory.DASHBOARD_SERVICES:
        return 'Dashboards';
      case ServiceCategory.MESSAGING_SERVICES:
        return 'Topics';
      case ServiceCategory.PIPELINE_SERVICES:
        return 'Pipelines';
      case ServiceCategory.ML_MODEL_SERVICES:
        return 'Models';
      case ServiceCategory.DATABASE_SERVICES:
      default:
        return 'Databases';
    }
  };

  const tabs = [
    {
      name: getCountLabel(),
      isProtected: false,

      position: 1,
      count: instanceCount,
    },
    {
      name: 'Ingestions',
      isProtected: false,

      position: 2,
      count: ingestions.length,
    },
    {
      name: 'Connection',
      isProtected: !servicePermission.EditAll,
      isHidden: !servicePermission.EditAll,
      position: 3,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        serviceDetails?.owner?.type === 'team'
          ? getTeamAndUserDetailsPath(serviceDetails?.owner?.name || '')
          : serviceDetails?.owner?.name || '',
      placeholderText: serviceDetails?.owner?.displayName || '',
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
    if (servicePageTabs(getCountLabel())[currentTabIndex].path !== tab) {
      setActiveTab(
        getCurrentServiceTab(
          servicePageTabs(getCountLabel())[currentTabIndex].path
        )
      );
      history.push({
        pathname: getServiceDetailsPath(
          serviceFQN,
          serviceCategory,
          servicePageTabs(getCountLabel())[currentTabIndex].path
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

  const getAirflowStatus = () => {
    return new Promise<void>((resolve, reject) => {
      checkAirflowStatus()
        .then((res) => {
          if (res.status === 200) {
            resolve();
          } else {
            reject();
          }
        })
        .catch(() => reject());
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

  const getTableHeaders = (): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Database Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Usage</th>
          </>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Topic Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Tags</th>
          </>
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Dashboard Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Tags</th>
          </>
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Pipeline Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Tags</th>
          </>
        );
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        return (
          <>
            <th className="tableHead-cell">Model Name</th>
            <th className="tableHead-cell">Description</th>
            <th className="tableHead-cell">Owner</th>
            <th className="tableHead-cell">Tags</th>
          </>
        );
      }
      default:
        return <></>;
    }
  };

  const getOptionalTableCells = (data: Database | Topic) => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        const database = data as Database;

        return (
          <td className="tableBody-cell">
            <p>
              {getUsagePercentile(
                database.usageSummary?.weeklyStats?.percentileRank || 0
              )}
            </p>
          </td>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        const topic = data as Topic;

        return (
          <td className="tableBody-cell">
            {topic.tags && topic.tags?.length > 0 ? (
              <TagsViewer
                showStartWith={false}
                sizeCap={-1}
                tags={topic.tags}
                type="border"
              />
            ) : (
              '--'
            )}
          </td>
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboard = data as Dashboard;

        return (
          <td className="tableBody-cell">
            {dashboard.tags && dashboard.tags?.length > 0 ? (
              <TagsViewer
                showStartWith={false}
                sizeCap={-1}
                tags={dashboard.tags}
                type="border"
              />
            ) : (
              '--'
            )}
          </td>
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipeline = data as Pipeline;

        return (
          <td className="tableBody-cell">
            {pipeline.tags && pipeline.tags?.length > 0 ? (
              <TagsViewer
                showStartWith={false}
                sizeCap={-1}
                tags={pipeline.tags}
                type="border"
              />
            ) : (
              '--'
            )}
          </td>
        );
      }
      case ServiceCategory.ML_MODEL_SERVICES: {
        const mlmodal = data as Mlmodel;

        return (
          <td className="tableBody-cell">
            {mlmodal.tags && mlmodal.tags?.length > 0 ? (
              <TagsViewer
                showStartWith={false}
                sizeCap={-1}
                tags={mlmodal.tags}
                type="border"
              />
            ) : (
              '--'
            )}
          </td>
        );
      }
      default:
        return <></>;
    }
  };

  useEffect(() => {
    setServiceName(
      (serviceCategory as ServiceTypes) ||
        getServiceCategoryFromType(serviceType)
    );
  }, [serviceCategory, serviceType]);

  useEffect(() => {
    if (servicePermission.ViewAll) {
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
    if (servicePermission.ViewAll) {
      const currentTab = getCurrentServiceTab(tab);
      const currentTabIndex = currentTab - 1;

      if (tabs[currentTabIndex].isProtected) {
        activeTabHandler(1);
      }

      getAirflowStatus()
        .then(() => {
          setIsAirflowRunning(true);
          getAllIngestionWorkflows();
        })
        .catch(() => {
          setIsAirflowRunning(false);
        });
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
        // TODO: Fix type issue below
      } as unknown as ServiceOption;

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
      // TODO: fix type issues below
    } as unknown as ServiceOption;

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
    if (!isAirflowRunning) {
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
    if (servicePageTabs(getCountLabel())[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentServiceTab(tab));
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

  return (
    <Row className="page-container" gutter={[16, 16]}>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError(serviceName as string, serviceFQN)}
        </ErrorPlaceHolder>
      ) : (
        <>
          {servicePermission.ViewAll ? (
            <Col span={24}>
              <div
                className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col"
                data-testid="service-page">
                <Space
                  align="center"
                  className="tw-justify-between"
                  style={{ width: '100%' }}>
                  <TitleBreadcrumb titleLinks={slashedTableName} />
                  <Tooltip
                    title={
                      servicePermission.Delete
                        ? 'Delete'
                        : NO_PERMISSION_FOR_ACTION
                    }>
                    <Button
                      data-testid="service-delete"
                      disabled={!servicePermission.Delete}
                      size="small"
                      theme="primary"
                      variant="outlined"
                      onClick={handleDelete}>
                      <IcDeleteColored
                        className="tw-mr-1.5"
                        height={14}
                        viewBox="0 0 24 24"
                        width={14}
                      />
                      Delete
                    </Button>
                  </Tooltip>
                  <DeleteWidgetModal
                    isRecursiveDelete
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

                <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-flex-wrap">
                  {extraInfo.map((info, index) => (
                    <span className="tw-flex" key={index}>
                      <EntitySummaryDetails
                        data={info}
                        updateOwner={
                          servicePermission.EditAll ||
                          servicePermission.EditOwner
                            ? handleUpdateOwner
                            : undefined
                        }
                      />

                      {extraInfo.length !== 1 &&
                      index < extraInfo.length - 1 ? (
                        <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                          |
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>

                <div
                  className="tw-my-2 tw--ml-5"
                  data-testid="description-container">
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
                </div>

                <div className="tw-mt-4 tw-flex tw-flex-col tw-flex-grow">
                  <TabsPane
                    activeTab={activeTab}
                    className="tw-flex-initial"
                    setActiveTab={activeTabHandler}
                    tabs={tabs}
                  />
                  <div className="tw-flex-grow">
                    {activeTab === 1 &&
                      (isEmpty(data) ? (
                        <ErrorPlaceHolder
                          doc={CONNECTORS_DOCS}
                          heading={servicesDisplayName[serviceName]}
                        />
                      ) : (
                        <Fragment>
                          <div
                            className="tw-my-4 tw-table-container"
                            data-testid="table-container">
                            <table
                              className="tw-bg-white tw-w-full"
                              data-testid="database-tables">
                              <thead>
                                <tr className="tableHead-row">
                                  {getTableHeaders()}
                                </tr>
                              </thead>
                              <tbody className="tableBody">
                                {data.map((dataObj, index) => (
                                  <tr
                                    className={classNames(
                                      'tableBody-row',
                                      !isEven(index + 1) ? 'odd-row' : null
                                    )}
                                    data-testid="column"
                                    key={index}>
                                    <td className="tableBody-cell">
                                      <Link
                                        to={getLinkForFqn(
                                          dataObj.fullyQualifiedName || ''
                                        )}>
                                        {getEntityName(
                                          dataObj as unknown as EntityReference
                                        )}
                                      </Link>
                                    </td>
                                    <td className="tableBody-cell">
                                      {dataObj.description ? (
                                        <RichTextEditorPreviewer
                                          markdown={dataObj.description}
                                        />
                                      ) : (
                                        <span className="tw-no-description">
                                          No description
                                        </span>
                                      )}
                                    </td>
                                    <td className="tableBody-cell">
                                      <p>{dataObj?.owner?.name || '--'}</p>
                                    </td>
                                    {getOptionalTableCells(dataObj as Database)}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
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
                        </Fragment>
                      ))}

                    {activeTab === 2 && getIngestionTab()}

                    {activeTab === 3 && (
                      <>
                        <div className="tw-my-4 tw-flex tw-justify-end">
                          <Tooltip
                            title={
                              servicePermission.EditAll
                                ? 'Edit Connection'
                                : NO_PERMISSION_FOR_ACTION
                            }>
                            <Button
                              className={classNames(
                                'tw-h-8 tw-rounded tw-px-4 tw-py-1'
                              )}
                              data-testid="add-new-service-button"
                              disabled={!servicePermission.EditAll}
                              size="small"
                              theme="primary"
                              variant="outlined"
                              onClick={handleEditConnection}>
                              Edit Connection
                            </Button>
                          </Tooltip>
                        </div>
                        <ServiceConnectionDetails
                          connectionDetails={connectionDetails || {}}
                          serviceCategory={serviceCategory}
                          serviceFQN={serviceDetails?.serviceType || ''}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Col>
          ) : (
            <ErrorPlaceHolder>{NO_PERMISSION_TO_VIEW}</ErrorPlaceHolder>
          )}
        </>
      )}
    </Row>
  );
};

export default ServicePage;
