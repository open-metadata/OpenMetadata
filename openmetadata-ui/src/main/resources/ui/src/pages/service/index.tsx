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
import { isNil, isUndefined } from 'lodash';
import { ExtraInfo, ServicesData } from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getDashboards } from '../../axiosAPIs/dashboardAPI';
import { getDatabases } from '../../axiosAPIs/databaseAPI';
import {
  deleteIngestionPipelineById,
  getIngestionPipelines,
  triggerIngestionPipelineById,
  updateIngestionPipeline,
} from '../../axiosAPIs/ingestionPipelineAPI';
import { fetchAirflowConfig } from '../../axiosAPIs/miscAPI';
import { getPipelines } from '../../axiosAPIs/pipelineAPI';
import { getServiceByFQN, updateService } from '../../axiosAPIs/serviceAPI';
import { getTopics } from '../../axiosAPIs/topicsAPI';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import Loader from '../../components/Loader/Loader';
import ManageTabComponent from '../../components/ManageTab/ManageTab.component';
import ServiceConfig from '../../components/ServiceConfig/ServiceConfig';
import TagsViewer from '../../components/tags-viewer/tags-viewer';
import {
  getServiceDetailsPath,
  getTeamAndUserDetailsPath,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateIngestionPipeline } from '../../generated/api/services/ingestionPipelines/createIngestionPipeline';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Database } from '../../generated/entity/data/database';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Topic } from '../../generated/entity/data/topic';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { IngestionPipeline } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { DataObj, ServiceDataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import {
  getEntityMissingError,
  getEntityName,
  hasEditAccess,
  isEven,
  pluralize,
} from '../../utils/CommonUtils';
import { getInfoElements } from '../../utils/EntityUtils';
import {
  getCurrentServiceTab,
  getIsIngestionEnable,
  getServiceCategoryFromType,
  servicePageTabs,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
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
  const [isIngestionEnable] = useState(
    getIsIngestionEnable(serviceName as ServiceCategory)
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

  const getCountLabel = () => {
    switch (serviceName) {
      case ServiceCategory.DASHBOARD_SERVICES:
        return 'Dashboards';
      case ServiceCategory.MESSAGING_SERVICES:
        return 'Topics';
      case ServiceCategory.PIPELINE_SERVICES:
        return 'Pipelines';
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
      isHidden: !isIngestionEnable,
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

  const deployIngestion = (data: IngestionPipeline) => {
    const {
      airflowConfig,
      description,
      displayName,
      name,
      owner,
      pipelineType,
      service,
      source,
    } = data;
    const updateData = {
      airflowConfig: {
        ...airflowConfig,
        forceDeploy: true,
      },
      description,
      displayName,
      name,
      owner,
      pipelineType,
      service,
      sourceConfig: source.sourceConfig,
    };

    return new Promise<void>((resolve, reject) => {
      return updateIngestionPipeline(updateData as CreateIngestionPipeline)
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

  const handleConfigUpdate = (
    updatedData: ServicesData,
    serviceCategory: ServiceCategory
  ) => {
    const configData =
      serviceCategory === ServiceCategory.PIPELINE_SERVICES
        ? {
            databaseConnection: updatedData.databaseConnection,
            name: updatedData.name,
            serviceType: updatedData.serviceType,
            brokers: updatedData.brokers,
            schemaRegistry: updatedData.schemaRegistry,
            dashboardUrl: updatedData.dashboardUrl,
            username: updatedData.username,
            password: updatedData.password,
            pipelineUrl: updatedData.pipelineUrl,
          }
        : {
            name: serviceDetails?.name,
            serviceType: serviceDetails?.serviceType,
            description: serviceDetails?.description,
            owner: serviceDetails?.owner,
            connection: {
              config: updatedData,
            },
          };

    return new Promise<void>((resolve, reject) => {
      updateService(serviceName, serviceDetails?.id, configData)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setServiceDetails({
              ...res.data,
              owner: res.data?.owner ?? serviceDetails?.owner,
            });
          } else {
            showErrorToast(
              `${jsonData['api-error-messages']['update-service-config-error']}`
            );
          }

          resolve();
        })
        .catch((error: AxiosError) => {
          reject();
          showErrorToast(
            error,
            `${jsonData['api-error-messages']['update-service-config-error']}`
          );
        });
    });
  };

  const fetchDatabases = (paging?: string) => {
    setIsloading(true);
    getDatabases(serviceFQN, paging, ['owner', 'usageSummary'])
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
              <TagsViewer sizeCap={-1} tags={topic.tags} />
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
              <TagsViewer sizeCap={-1} tags={dashboard.tags} />
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
              <TagsViewer sizeCap={-1} tags={pipeline.tags} />
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
        return `Deleting this ${service} will also delete ${pluralize(
          instanceCount,
          'database',
          's'
        )}`;

      case ServiceCategory.MESSAGING_SERVICES:
        return `Deleting this ${service} will also delete ${pluralize(
          instanceCount,
          'topic',
          's'
        )}`;

      case ServiceCategory.DASHBOARD_SERVICES:
        return `Deleting this ${service} will also delete ${pluralize(
          instanceCount,
          'dashboard',
          's'
        )}`;

      case ServiceCategory.PIPELINE_SERVICES:
        return `Deleting this ${service} will also delete ${pluralize(
          instanceCount,
          'pipeline',
          's'
        )}`;

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
          setDescription(description);
          setSlashedTableName([
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

    if (isIngestionEnable) {
      // getDatabaseServices();
      getAllIngestionWorkflows();
    }
  }, []);

  const onCancel = () => {
    setIsEdit(false);
  };

  const getServiceSpecificData = (serviceDetails?: ServiceDataObj) => {
    switch (serviceCategory) {
      case ServiceCategory.DATABASE_SERVICES:
      case ServiceCategory.MESSAGING_SERVICES:
      case ServiceCategory.DASHBOARD_SERVICES:
        return {
          connection: serviceDetails?.connection,
        };

      case ServiceCategory.PIPELINE_SERVICES:
        return {
          pipelineUrl: serviceDetails?.pipelineUrl,
        };

      default:
        return {};
    }
  };

  const onDescriptionUpdate = (updatedHTML: string) => {
    if (description !== updatedHTML && !isUndefined(serviceDetails)) {
      const { id } = serviceDetails;

      const updatedServiceDetails = {
        ...getServiceSpecificData(serviceDetails),
        name: serviceDetails.name,
        serviceType: serviceDetails.serviceType,
        description: updatedHTML,
      };

      updateService(serviceName, id, updatedServiceDetails)
        .then(() => {
          setDescription(updatedHTML);
          setServiceDetails({
            ...updatedServiceDetails,
            id,
            owner: serviceDetails?.owner,
          });
          setIsEdit(false);
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            jsonData['api-error-messages']['update-description-error']
          );
        });
    } else {
      setIsEdit(false);
    }
  };

  const handleUpdateOwner = (owner: ServiceDataObj['owner']) => {
    const updatedData = {
      ...getServiceSpecificData(serviceDetails),
      name: serviceDetails?.name,
      serviceType: serviceDetails?.serviceType,
      owner,
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

  useEffect(() => {
    if (servicePageTabs(getCountLabel())[activeTab - 1].path !== tab) {
      setActiveTab(getCurrentServiceTab(tab));
    }
  }, [tab]);

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
                  {getInfoElements(info)}
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
                                    {serviceName ===
                                      ServiceCategory.DASHBOARD_SERVICES &&
                                    (dataObj as Dashboard).displayName
                                      ? (dataObj as Dashboard).displayName
                                      : dataObj.name}
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

                {activeTab === 2 &&
                  (isUndefined(airflowEndpoint) ? (
                    <Loader />
                  ) : (
                    <div data-testid="ingestion-container">
                      <Ingestion
                        isRequiredDetailsAvailable
                        airflowEndpoint={airflowEndpoint}
                        currrentPage={ingestionCurrentPage}
                        deleteIngestion={deleteIngestionById}
                        deployIngestion={deployIngestion}
                        ingestionList={ingestions}
                        paging={ingestionPaging}
                        pagingHandler={ingestionPagingHandler}
                        serviceCategory={serviceName as ServiceCategory}
                        serviceDetails={serviceDetails as DataObj}
                        serviceList={serviceList}
                        serviceName={serviceFQN}
                        triggerIngestion={triggerIngestionById}
                      />
                    </div>
                  ))}

                {activeTab === 3 && (isAdminUser || isAuthDisabled) && (
                  <ServiceConfig
                    data={serviceDetails as ServicesData}
                    handleUpdate={handleConfigUpdate}
                    serviceCategory={serviceName as ServiceCategory}
                  />
                )}

                {activeTab === 4 && (
                  <div className="tw-bg-white tw-h-full tw-pt-4 tw-pb-6">
                    <ManageTabComponent
                      allowDelete
                      hideTier
                      isRecursiveDelete
                      currentUser={serviceDetails?.owner?.id}
                      deletEntityMessage={getDeleteEntityMessage()}
                      entityId={serviceDetails?.id}
                      entityName={serviceDetails?.name}
                      entityType={serviceCategory.slice(0, -1)}
                      hasEditAccess={hasEditAccess(
                        serviceDetails?.owner?.type || '',
                        serviceDetails?.owner?.id || ''
                      )}
                      manageSectionType={serviceCategory.slice(0, -1)}
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
