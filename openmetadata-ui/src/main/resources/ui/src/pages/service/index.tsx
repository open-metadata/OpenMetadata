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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNil, isUndefined, startCase } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getDashboards } from '../../axiosAPIs/dashboardAPI';
import { getDatabases } from '../../axiosAPIs/databaseAPI';
import { checkAirflowStatus, deleteIngestionPipelineById, deployIngestionPipelineById, enableDisableIngestionPipelineById, getIngestionPipelines, triggerIngestionPipelineById } from '../../axiosAPIs/ingestionPipelineAPI';
import { fetchAirflowConfig } from '../../axiosAPIs/miscAPI';
import { getMlmodels } from '../../axiosAPIs/mlModelAPI';
import { getPipelines } from '../../axiosAPIs/pipelineAPI';
import { getServiceByFQN, updateService } from '../../axiosAPIs/serviceAPI';
import { getTopics } from '../../axiosAPIs/topicsAPI';
import { Button } from '../../components/buttons/Button/Button';
import Description from '../../components/common/description/Description';
import EntitySummaryDetails from '../../components/common/EntitySummaryDetails/EntitySummaryDetails';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from '../../components/common/error-with-placeholder/ErrorPlaceHolderIngestion';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import Loader from '../../components/Loader/Loader';
import ManageTabComponent from '../../components/ManageTab/ManageTab.component';
import ServiceConnectionDetails from '../../components/ServiceConnectionDetails/ServiceConnectionDetails.component';
import TagsViewer from '../../components/tags-viewer/tags-viewer';
import { getServiceDetailsPath, getTeamAndUserDetailsPath, PAGE_SIZE, pagingObject } from '../../constants/constants';
import { ADMIN_ONLY_ACCESSIBLE_SECTION } from '../../enums/common.enum';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { OwnerType } from '../../enums/user.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Database } from '../../generated/entity/data/database';
import { Mlmodel } from '../../generated/entity/data/mlmodel';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Topic } from '../../generated/entity/data/topic';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { ConfigData, ServiceDataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import { getEntityDeleteMessage, getEntityMissingError, getEntityName, hasEditAccess, isEven, pluralize } from '../../utils/CommonUtils';
import { getEditConnectionPath, getServicesWithTabPath } from '../../utils/RouterUtils';
import { getCurrentServiceTab, getServiceCategoryFromType, servicePageTabs, serviceTypeLogo, setServiceSchemaCount, setServiceTableCount } from '../../utils/ServiceUtils';
import { getEntityLink, getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

type Data = Database & Topic & Dashboard;

const ServicePage: FunctionComponent = () => {
  const { serviceFQN, serviceType, serviceCategory, tab } =
    useParams() as Record<string, string>;
  const history = useHistory();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [serviceName, setServiceName] = useState(
    serviceCategory || getServiceCategoryFromType(serviceType)
  );
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceDetails, setServiceDetails] = useState<ServiceDataObj>();
  const [data, setData] = useState<Array<Data>>([]);
  const [isLoading, setIsloading] = useState(true);
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

  const getCountLabel = () => {
    switch (serviceName) {
      case ServiceCategory.DASHBOARD_SERVICES:
        return 'Dashboards';
      case ServiceCategory.MESSAGING_SERVICES:
        return 'Topics';
      case ServiceCategory.PIPELINE_SERVICES:
        return 'Pipelines';
      case ServiceCategory.ML_MODAL_SERVICES:
        return 'Models';
      case ServiceCategory.DATABASE_SERVICES:
      default:
        return 'Databases';
    }
  };

  const tabs = [
    {
      name: getCountLabel(),
      icon: {
        alt: 'schema',
        name: 'icon-database',
        title: 'Database',
        selectedName: 'icon-schemacolor',
      },
      isProtected: false,
      position: 1,
      count: instanceCount,
    },
    {
      name: 'Ingestions',
      icon: {
        alt: 'sample_data',
        name: 'sample-data',
        title: 'Sample Data',
        selectedName: 'sample-data-color',
      },
      isProtected: false,
      position: 2,
      count: ingestions.length,
    },
    {
      name: 'Connection',
      icon: {
        alt: 'sample_data',
        name: 'sample-data',
        title: 'Sample Data',
        selectedName: 'sample-data-color',
      },

      isProtected: !isAdminUser && !isAuthDisabled,
      isHidden: !isAdminUser && !isAuthDisabled,
      position: 3,
    },
    {
      name: 'Manage',
      icon: {
        alt: 'manage',
        name: 'icon-manage',
        title: 'Manage',
        selectedName: 'icon-managecolor',
      },
      isProtected: false,
      position: 4,
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
        if (res.data?.apiEndpoint) {
          setAirflowEndpoint(res.data.apiEndpoint);
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
    setIsloading(true);
    getIngestionPipelines(['owner', 'pipelineStatuses'], serviceFQN, paging)
      .then((res) => {
        if (res.data.data) {
          setIngestions(res.data.data);
          setIngestionPaging(res.data.paging);
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
        setIsloading(false);
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
        .finally(() => setIsloading(false));
    });
  };

  const deployIngestion = (id: string) => {
    return new Promise<void>((resolve, reject) => {
      return deployIngestionPipelineById(id)
        .then((res: AxiosResponse) => {
          if (res.data) {
            resolve();
            setTimeout(() => {
              getAllIngestionWorkflows();
              setIsloading(false);
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
      .then((res: AxiosResponse) => {
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
    }).finally(() => setIsloading(false));
  };

  const fetchDatabases = (paging?: string) => {
    setIsloading(true);
    getDatabases(serviceFQN, paging, ['owner', 'usageSummary'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setServiceSchemaCount(res.data.data, setSchemaCount);
          setServiceTableCount(res.data.data, setTableCount);
          setPaging(res.data.paging);
          setInstanceCount(res.data.paging.total);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
      });
  };

  const fetchTopics = (paging?: string) => {
    setIsloading(true);
    getTopics(serviceFQN, paging, ['owner', 'tags'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
          setInstanceCount(res.data.paging.total);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
      });
  };

  const fetchDashboards = (paging?: string) => {
    setIsloading(true);
    getDashboards(serviceFQN, paging, ['owner', 'usageSummary', 'tags'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
          setInstanceCount(res.data.paging.total);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
      });
  };

  const fetchPipeLines = (paging?: string) => {
    setIsloading(true);
    getPipelines(serviceFQN, paging, ['owner', 'tags'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
          setInstanceCount(res.data.paging.total);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
      });
  };

  const fetchMlModal = (paging = '') => {
    setIsloading(true);
    getMlmodels(serviceFQN, paging, ['owner', 'tags'])
      .then((res: AxiosResponse) => {
        if (res.data.data) {
          setData(res.data.data);
          setPaging(res.data.paging);
          setInstanceCount(res.data.paging.total);
          setIsloading(false);
        } else {
          setData([]);
          setPaging(pagingObject);
          setIsloading(false);
        }
      })
      .catch(() => {
        setIsloading(false);
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
      case ServiceCategory.ML_MODAL_SERVICES: {
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

      case ServiceCategory.ML_MODAL_SERVICES:
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
      case ServiceCategory.ML_MODAL_SERVICES: {
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
      case ServiceCategory.ML_MODAL_SERVICES: {
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

  const getDeleteEntityMessage = () => {
    const service = serviceName?.slice(0, -1);

    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES:
        return getEntityDeleteMessage(
          service || 'Service',
          `${pluralize(instanceCount, 'Database')}, ${pluralize(
            schemaCount,
            'Schema'
          )} and ${pluralize(tableCount, 'Table')}`
        );

      case ServiceCategory.MESSAGING_SERVICES:
        return getEntityDeleteMessage(
          service || 'Service',
          pluralize(instanceCount, 'Topic')
        );

      case ServiceCategory.DASHBOARD_SERVICES:
        return getEntityDeleteMessage(
          service || 'Service',
          pluralize(instanceCount, 'Dashboard')
        );

      case ServiceCategory.PIPELINE_SERVICES:
        return getEntityDeleteMessage(
          service || 'Service',
          pluralize(instanceCount, 'Pipeline')
        );

      default:
        return;
    }
  };

  useEffect(() => {
    setServiceName(serviceCategory || getServiceCategoryFromType(serviceType));
  }, [serviceCategory, serviceType]);

  useEffect(() => {
    setIsloading(true);
    getServiceByFQN(serviceName, serviceFQN, ['owner'])
      .then((resService: AxiosResponse) => {
        if (resService.data) {
          const { description, serviceType } = resService.data;
          setServiceDetails(resService.data);
          setConnectionDetails(resService.data?.connection?.config);
          setDescription(description);
          setSlashedTableName([
            {
              name: startCase(serviceName || ''),
              url: getServicesWithTabPath(serviceName || ''),
            },
            {
              name: getEntityName(resService.data),
              url: '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
              activeTitle: true,
            },
          ]);
          getOtherDetails();
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-service-error']);
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
      .finally(() => setIsloading(false));
  }, [serviceFQN, serviceName]);

  useEffect(() => {
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
  }, []);

  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML && !isUndefined(serviceDetails)) {
      const { id } = serviceDetails;

      const updatedServiceDetails = {
        connection: serviceDetails?.connection,
        name: serviceDetails.name,
        serviceType: serviceDetails.serviceType,
        description: updatedHTML,
        owner: serviceDetails.owner,
      };

      updateService(serviceName, id, updatedServiceDetails)
        .then((res: AxiosResponse) => {
          setDescription(updatedHTML);
          setServiceDetails(res.data);
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-description-error']
          );
        })
        .finally(() => setIsEdit(false));
    } else {
      setIsEdit(false);
    }
  };

  const handleUpdateOwner = (owner: ServiceDataObj['owner']) => {
    const updatedData = {
      connection: serviceDetails?.connection,
      name: serviceDetails?.name,
      serviceType: serviceDetails?.serviceType,
      owner,
      description: serviceDetails?.description,
    };

    return new Promise<void>((resolve, reject) => {
      updateService(serviceName, serviceDetails?.id, updatedData)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setServiceDetails(res.data);

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
            serviceCategory={serviceName as ServiceCategory}
            serviceDetails={serviceDetails as ServiceDataObj}
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

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError(serviceName as string, serviceFQN)}
        </ErrorPlaceHolder>
      ) : (
        <PageContainer>
          <div
            className="tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col"
            data-testid="service-page">
            <TitleBreadcrumb titleLinks={slashedTableName} />

            <div className="tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-ml-7 tw-flex-wrap">
              {extraInfo.map((info, index) => (
                <span className="tw-flex" key={index}>
                  <EntitySummaryDetails
                    data={info}
                    updateOwner={handleUpdateOwner}
                  />

                  {extraInfo.length !== 1 && index < extraInfo.length - 1 ? (
                    <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">
                      |
                    </span>
                  ) : null}
                </span>
              ))}
            </div>

            <div
              className="tw-my-2 tw-ml-2"
              data-testid="description-container">
              <Description
                blurWithBodyBG
                description={description || ''}
                entityFqn={serviceFQN}
                entityName={serviceFQN}
                entityType={serviceCategory.slice(0, -1)}
                hasEditAccess={isAdminUser || isAuthDisabled}
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
                {activeTab === 1 && (
                  <Fragment>
                    <div
                      className="tw-mt-4 tw-px-1"
                      data-testid="table-container">
                      <table
                        className="tw-bg-white tw-w-full tw-mb-4"
                        data-testid="database-tables">
                        <thead>
                          <tr className="tableHead-row">{getTableHeaders()}</tr>
                        </thead>
                        <tbody className="tableBody">
                          {data.length > 0 ? (
                            data.map((dataObj, index) => (
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
                                {getOptionalTableCells(dataObj)}
                              </tr>
                            ))
                          ) : (
                            <tr className="tableBody-row">
                              <td
                                className="tableBody-cell tw-text-center"
                                colSpan={4}>
                                No records found.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
                      <NextPrevious
                        currentPage={currentPage}
                        pageSize={PAGE_SIZE}
                        paging={paging}
                        pagingHandler={pagingHandler}
                        totalCount={paging.total}
                      />
                    )}
                  </Fragment>
                )}

                {activeTab === 2 && getIngestionTab()}

                {activeTab === 3 && (isAdminUser || isAuthDisabled) && (
                  <>
                    <div className="tw-my-4 tw-flex tw-justify-end">
                      <Button
                        className={classNames(
                          'tw-h-8 tw-rounded tw-px-4 tw-py-1',
                          {
                            'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                          }
                        )}
                        data-testid="add-new-service-button"
                        size="small"
                        theme="primary"
                        variant="outlined"
                        onClick={handleEditConnection}>
                        Edit Connection
                      </Button>
                    </div>
                    <ServiceConnectionDetails
                      connectionDetails={connectionDetails || {}}
                      serviceCategory={serviceCategory}
                      serviceFQN={serviceDetails?.serviceType || ''}
                    />
                  </>
                )}

                {activeTab === 4 && (
                  <div className="tw-bg-white tw-h-full tw-pt-4 tw-pb-6">
                    <ManageTabComponent
                      allowDelete
                      hideTier
                      isRecursiveDelete
                      currentUser={serviceDetails?.owner}
                      deletEntityMessage={getDeleteEntityMessage()}
                      entityId={serviceDetails?.id}
                      entityName={serviceDetails?.name}
                      entityType={serviceCategory.slice(0, -1)}
                      hasEditAccess={hasEditAccess(
                        serviceDetails?.owner?.type || '',
                        serviceDetails?.owner?.id || ''
                      )}
                      manageSectionType={ADMIN_ONLY_ACCESSIBLE_SECTION.SERVICE}
                      onSave={handleUpdateOwner}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </PageContainer>
      )}
    </>
  );
};

export default ServicePage;
