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
import { compare } from 'fast-json-patch';
import { isNil, isUndefined } from 'lodash';
import {
  EntityFieldThreadCount,
  EntityThread,
  ExtraInfo,
  Paging,
  ServicesData,
} from 'Models';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import AppState from '../../AppState';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import {
  addAirflowPipeline,
  deleteAirflowPipelineById,
  getAirflowPipelines,
  triggerAirflowPipelineById,
  updateAirflowPipeline,
} from '../../axiosAPIs/airflowPipelineAPI';
import { getDashboards } from '../../axiosAPIs/dashboardAPI';
import { getDatabases } from '../../axiosAPIs/databaseAPI';
import {
  getAllFeeds,
  getFeedCount,
  postFeedById,
  postThread,
} from '../../axiosAPIs/feedsAPI';
import { getPipelines } from '../../axiosAPIs/pipelineAPI';
import { getServiceByFQN, updateService } from '../../axiosAPIs/serviceAPI';
import { getTopics } from '../../axiosAPIs/topicsAPI';
import ActivityFeedList from '../../components/ActivityFeed/ActivityFeedList/ActivityFeedList';
import ActivityThreadPanel from '../../components/ActivityFeed/ActivityThreadPanel/ActivityThreadPanel';
import Description from '../../components/common/description/Description';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import IngestionError from '../../components/common/error/IngestionError';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../../components/common/TabsPane/TabsPane';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import Loader from '../../components/Loader/Loader';
import ManageTabComponent from '../../components/ManageTab/ManageTab.component';
import RequestDescriptionModal from '../../components/Modals/RequestDescriptionModal/RequestDescriptionModal';
import ServiceConfig from '../../components/ServiceConfig/ServiceConfig';
import TagsViewer from '../../components/tags-viewer/tags-viewer';
import {
  getServiceDetailsPath,
  getTeamDetailsPath,
  pagingObject,
} from '../../constants/constants';
import { TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateThread } from '../../generated/api/feed/createThread';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Database } from '../../generated/entity/data/database';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Topic } from '../../generated/entity/data/topic';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import {
  AirflowPipeline,
  PipelineType,
  Schema,
} from '../../generated/operations/pipelines/airflowPipeline';
import { EntityReference } from '../../generated/type/entityReference';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import { ServiceDataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import {
  getEntityMissingError,
  hasEditAccess,
  isEven,
} from '../../utils/CommonUtils';
import { getEntityFeedLink, getInfoElements } from '../../utils/EntityUtils';
import { getDefaultValue } from '../../utils/FeedElementUtils';
import {
  deletePost,
  getEntityFieldThreadCounts,
  getUpdatedThread,
} from '../../utils/FeedUtils';
import {
  getCurrentServiceTab,
  getIsIngestionEnable,
  getServiceCategoryFromType,
  isRequiredDetailsAvailableForIngestion,
  servicePageTabs,
  serviceTypeLogo,
} from '../../utils/ServiceUtils';
import { getEntityLink, getUsagePercentile } from '../../utils/TableUtils';

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
  const [isConnectionAvailable, setConnectionAvailable] =
    useState<boolean>(true);
  const [isError, setIsError] = useState(false);
  const [ingestions, setIngestions] = useState<AirflowPipeline[]>([]);
  const [serviceList] = useState<Array<DatabaseService>>([]);
  const [ingestionPaging, setIngestionPaging] = useState<Paging>({} as Paging);
  const showToast = useToastContext();
  const [entityThread, setEntityThread] = useState<EntityThread[]>([]);
  const [isentityThreadLoading, setIsentityThreadLoading] =
    useState<boolean>(false);
  const [feedCount, setFeedCount] = useState<number>(0);
  const [entityFieldThreadCount, setEntityFieldThreadCount] = useState<
    EntityFieldThreadCount[]
  >([]);

  const [threadLink, setThreadLink] = useState<string>('');
  const [selectedField, setSelectedField] = useState<string>('');

  const handleShowErrorToast = (errMessage: string) => {
    showToast({
      variant: 'error',
      body: errMessage,
    });
  };

  const handleShowSuccessToast = (message: string) => {
    showToast({
      variant: 'success',
      body: message,
    });
  };

  const onEntityFieldSelect = (value: string) => {
    setSelectedField(value);
  };
  const closeRequestModal = () => {
    setSelectedField('');
  };

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
      name: 'Activity Feed',
      icon: {
        alt: 'activity_feed',
        name: 'activity_feed',
        title: 'Activity Feed',
        selectedName: 'activity-feed-color',
      },
      isProtected: false,
      position: 2,
      count: feedCount,
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
      position: 3,
      count: ingestions.length,
    },
    {
      name: 'Connection Config',
      icon: {
        alt: 'sample_data',
        name: 'sample-data',
        title: 'Sample Data',
        selectedName: 'sample-data-color',
      },

      isProtected: !isAdminUser && !isAuthDisabled,
      position: 4,
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
      position: 5,
    },
  ];

  const extraInfo: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value:
        serviceDetails?.owner?.type === 'team'
          ? getTeamDetailsPath(serviceDetails?.owner?.name || '')
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

  const onThreadLinkSelect = (link: string) => {
    setThreadLink(link);
  };

  const onThreadPanelClose = () => {
    setThreadLink('');
  };

  const getEntityFeedCount = () => {
    getFeedCount(getEntityFeedLink(serviceCategory.slice(0, -1), serviceFQN))
      .then((res: AxiosResponse) => {
        if (res.data) {
          setFeedCount(res.data.totalCount);
          setEntityFieldThreadCount(res.data.counts);
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-count-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['fetch-entity-feed-count-error'];
        handleShowErrorToast(message);
      });
  };

  const getSchemaFromType = (type: AirflowPipeline['pipelineType']) => {
    switch (type) {
      case PipelineType.Metadata:
        return Schema.DatabaseServiceMetadataPipeline;

      case PipelineType.QueryUsage:
        return Schema.DatabaseServiceQueryUsagePipeline;

      default:
        return;
    }
  };

  const getAllIngestionWorkflows = (paging?: string) => {
    setIsloading(true);
    getAirflowPipelines(['owner', 'pipelineStatuses'], serviceFQN, '', paging)
      .then((res) => {
        if (res.data.data) {
          setIngestions(res.data.data);
          setIngestionPaging(res.data.paging);
        } else {
          setIngestionPaging({} as Paging);
          handleShowErrorToast(
            jsonData['api-error-messages']['fetch-ingestion-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['fetch-ingestion-error'];
        handleShowErrorToast(message);
      })
      .finally(() => setIsloading(false));
  };

  const triggerIngestionById = (
    id: string,
    displayName: string
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      triggerAirflowPipelineById(id)
        .then((res) => {
          if (res.data) {
            resolve();
            getAllIngestionWorkflows();
          } else {
            reject();
            handleShowErrorToast(
              `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`
            );
          }
        })
        .catch((error: AxiosError) => {
          const message =
            error.response?.data?.message ||
            `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`;
          handleShowErrorToast(message);
          reject();
        })
        .finally(() => setIsloading(false));
    });
  };

  const deleteIngestionById = (
    id: string,
    displayName: string
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      deleteAirflowPipelineById(id)
        .then(() => {
          resolve();
          getAllIngestionWorkflows();
        })
        .catch((error: AxiosError) => {
          const message =
            error.response?.data?.message ||
            `${jsonData['api-error-messages']['delete-ingestion-error']} ${displayName}`;

          handleShowErrorToast(message);
          reject();
        });
    }).finally(() => setIsloading(false));
  };

  const updateIngestion = (
    data: AirflowPipeline,
    oldData: AirflowPipeline,
    id: string,
    displayName: string,
    triggerIngestion?: boolean
  ): Promise<void> => {
    const jsonPatch = compare(oldData, data);

    return new Promise<void>((resolve, reject) => {
      updateAirflowPipeline(id, jsonPatch)
        .then(() => {
          resolve();
          getAllIngestionWorkflows();
          if (triggerIngestion) {
            triggerIngestionById(id, displayName).catch((error: AxiosError) => {
              const message =
                error.response?.data?.message ||
                `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`;
              handleShowErrorToast(message);
            });
          }
        })
        .catch((error: AxiosError) => {
          const message =
            error.response?.data?.message ||
            `${jsonData['api-error-messages']['update-ingestion-error']}`;
          handleShowErrorToast(message);
          reject();
        });
    });
  };

  const addIngestionWorkflowHandler = (
    data: AirflowPipeline,
    triggerIngestion?: boolean
  ) => {
    setIsloading(true);

    const ingestionData: AirflowPipeline = {
      ...data,
      pipelineConfig: {
        ...data.pipelineConfig,
        schema: getSchemaFromType(data.pipelineType),
      },
      service: {
        id: serviceDetails?.id,
        type: 'databaseService',
        name: data.service.name,
      } as EntityReference,
    };

    addAirflowPipeline(ingestionData)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { id, displayName } = res.data;
          setIsloading(false);
          getAllIngestionWorkflows();
          if (triggerIngestion) {
            triggerIngestionById(id, displayName).catch((error: AxiosError) => {
              const message =
                error.response?.data?.message ||
                `${jsonData['api-error-messages']['triggering-ingestion-error']} ${displayName}`;

              handleShowErrorToast(message);
            });
          }
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['add-ingestion-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['add-ingestion-error'];
        if (message.includes('Connection refused')) {
          setConnectionAvailable(false);
        } else {
          handleShowErrorToast(message);
        }
        setIsloading(false);
      });
  };

  const handleConfigUpdate = (updatedData: ServicesData) => {
    const configData = {
      databaseConnection: updatedData.databaseConnection,
      name: updatedData.name,
      serviceType: updatedData.serviceType,
      brokers: updatedData.brokers,
      schemaRegistry: updatedData.schemaRegistry,
      dashboardUrl: updatedData.dashboardUrl,
      username: updatedData.username,
      password: updatedData.password,
      pipelineUrl: updatedData.pipelineUrl,
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
            handleShowErrorToast(
              `${jsonData['api-error-messages']['update-service-config-error']}`
            );
          }

          resolve();
        })
        .catch((error: AxiosError) => {
          reject();
          const message =
            error.response?.data?.message ||
            `${jsonData['api-error-messages']['update-service-config-error']}`;
          handleShowErrorToast(message);
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
              name: serviceFQN,
              url: '',
              imgSrc: serviceType ? serviceTypeLogo(serviceType) : undefined,
              activeTitle: true,
            },
          ]);
          getOtherDetails();
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['fetch-service-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        if (error.response?.status === 404) {
          setIsError(true);
        } else {
          const message =
            error.response?.data?.message ||
            jsonData['api-error-messages']['fetch-service-error'];
          handleShowErrorToast(message);
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
        return {
          databaseConnection: serviceDetails?.connection ?? {},
        };

      case ServiceCategory.MESSAGING_SERVICES:
        return {
          brokers: serviceDetails?.connection?.config?.bootstrapServers,
          schemaRegistry: serviceDetails?.connection?.config?.schemaRegistryURL,
        };

      case ServiceCategory.DASHBOARD_SERVICES:
        return {
          dashboardUrl: serviceDetails?.dashboardUrl,
          username: serviceDetails?.username,
          password: serviceDetails?.password,
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
            owner: serviceDetails?.owner,
          });
          setIsEdit(false);
          getEntityFeedCount();
        })
        .catch((error: AxiosError) => {
          const message =
            error.response?.data?.message ||
            jsonData['api-error-messages']['update-description-error'];
          handleShowErrorToast(message);
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

    return new Promise<void>((_, reject) => {
      updateService(serviceName, serviceDetails?.id, updatedData)
        .then((res: AxiosResponse) => {
          if (res.data) {
            setServiceDetails(res.data);
          } else {
            handleShowErrorToast(
              jsonData['api-error-messages']['update-owner-error']
            );
          }
          reject();
        })
        .catch((error: AxiosError) => {
          const message =
            error.response?.data?.message ||
            jsonData['api-error-messages']['update-owner-error'];
          handleShowErrorToast(message);
          reject();
        });
    });
  };

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const pagingHandler = (cursorType: string) => {
    const pagingString = `&${cursorType}=${
      paging[cursorType as keyof typeof paging]
    }`;
    getOtherDetails(pagingString);
  };

  const ingestionPagingHandler = (cursorType: string) => {
    const pagingString = `&${cursorType}=${
      ingestionPaging[cursorType as keyof typeof paging]
    }`;

    getAllIngestionWorkflows(pagingString);
  };
  const fetchActivityFeed = () => {
    setIsentityThreadLoading(true);
    getAllFeeds(getEntityFeedLink(serviceCategory.slice(0, -1), serviceFQN))
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { data } = res.data;
          setEntityThread(data);
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['fetch-entity-feed-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['fetch-entity-feed-error'];
        handleShowErrorToast(message);
      })
      .finally(() => setIsentityThreadLoading(false));
  };

  const postFeedHandler = (value: string, id: string) => {
    const currentUser = AppState.userDetails?.name ?? AppState.users[0]?.name;

    const data = {
      message: value,
      from: currentUser,
    };
    postFeedById(id, data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          const { id, posts } = res.data;
          setEntityThread((pre) => {
            return pre.map((thread) => {
              if (thread.id === id) {
                return { ...res.data, posts: posts.slice(-3) };
              } else {
                return thread;
              }
            });
          });
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['create-message-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['create-message-error'];
        handleShowErrorToast(message);
      });
  };

  const createThread = (data: CreateThread) => {
    postThread(data)
      .then((res: AxiosResponse) => {
        if (res.data) {
          setEntityThread((pre) => [...pre, res.data]);
          getEntityFeedCount();

          handleShowSuccessToast(
            jsonData['api-success-messages']['create-conversation']
          );
        } else {
          handleShowErrorToast(
            jsonData['api-error-messages']['create-conversation-error']
          );
        }
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['create-conversation-error'];
        handleShowErrorToast(message);
      });
  };

  const deletePostHandler = (threadId: string, postId: string) => {
    deletePost(threadId, postId)
      .then(() => {
        getUpdatedThread(threadId)
          .then((data) => {
            if (data) {
              setEntityThread((pre) => {
                return pre.map((thread) => {
                  if (thread.id === data.id) {
                    return {
                      ...thread,
                      posts: data.posts.slice(-3),
                      postsCount: data.postsCount,
                    };
                  } else {
                    return thread;
                  }
                });
              });
            } else {
              handleShowErrorToast(
                jsonData['api-error-messages'][
                  'fetch-updated-conversation-error'
                ]
              );
            }
          })
          .catch((error: AxiosError) => {
            const message =
              error.response?.data?.message ||
              jsonData['api-error-messages'][
                'fetch-updated-conversation-error'
              ];
            handleShowErrorToast(message);
          });

        handleShowSuccessToast(
          jsonData['api-success-messages']['delete-message']
        );
      })
      .catch((error: AxiosError) => {
        const message =
          error.response?.data?.message ||
          jsonData['api-error-messages']['delete-message-error'];
        handleShowErrorToast(message);
      });
  };

  useEffect(() => {
    getEntityFeedCount();
  }, []);

  useEffect(() => {
    if (TabSpecificField.ACTIVITY_FEED === tab) {
      fetchActivityFeed();
    }
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
                entityFieldThreads={getEntityFieldThreadCounts(
                  'description',
                  entityFieldThreadCount
                )}
                entityFqn={serviceFQN}
                entityName={serviceFQN}
                entityType={serviceCategory.slice(0, -1)}
                isEdit={isEdit}
                onCancel={onCancel}
                onDescriptionEdit={onDescriptionEdit}
                onDescriptionUpdate={onDescriptionUpdate}
                onEntityFieldSelect={onEntityFieldSelect}
                onThreadLinkSelect={onThreadLinkSelect}
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
                        paging={paging}
                        pagingHandler={pagingHandler}
                      />
                    )}
                  </Fragment>
                )}
                {activeTab === 2 && (
                  <div
                    className="tw-py-4 tw-px-7 tw-grid tw-grid-cols-3 entity-feed-list tw-bg-body-main tw--mx-7 tw-h-screen"
                    id="activityfeed">
                    <div />
                    <ActivityFeedList
                      isEntityFeed
                      withSidePanel
                      className=""
                      deletePostHandler={deletePostHandler}
                      entityName={serviceFQN}
                      feedList={entityThread}
                      isLoading={isentityThreadLoading}
                      postFeedHandler={postFeedHandler}
                    />
                    <div />
                  </div>
                )}

                {activeTab === 3 && (
                  <div
                    className="tw-mt-4 tw-px-1"
                    data-testid="ingestion-container">
                    {isConnectionAvailable ? (
                      <Ingestion
                        addIngestion={addIngestionWorkflowHandler}
                        deleteIngestion={deleteIngestionById}
                        ingestionList={ingestions}
                        isRequiredDetailsAvailable={isRequiredDetailsAvailableForIngestion(
                          serviceName as ServiceCategory,
                          serviceDetails as ServicesData
                        )}
                        paging={ingestionPaging}
                        pagingHandler={ingestionPagingHandler}
                        serviceList={serviceList}
                        serviceName={serviceFQN}
                        serviceType={serviceDetails?.serviceType}
                        triggerIngestion={triggerIngestionById}
                        updateIngestion={updateIngestion}
                      />
                    ) : (
                      <IngestionError />
                    )}
                  </div>
                )}

                {activeTab === 4 && (isAdminUser || isAuthDisabled) && (
                  <ServiceConfig
                    data={serviceDetails as ServicesData}
                    handleUpdate={handleConfigUpdate}
                    serviceCategory={serviceName as ServiceCategory}
                  />
                )}

                {activeTab === 5 && (
                  <div className="tw-bg-white tw-h-full tw-pt-4 tw-pb-6">
                    <ManageTabComponent
                      hideTier
                      currentUser={serviceDetails?.owner?.id}
                      hasEditAccess={hasEditAccess(
                        serviceDetails?.owner?.type || '',
                        serviceDetails?.owner?.id || ''
                      )}
                      onSave={handleUpdateOwner}
                    />
                  </div>
                )}
              </div>
            </div>
            {threadLink ? (
              <ActivityThreadPanel
                createThread={createThread}
                deletePostHandler={deletePostHandler}
                open={Boolean(threadLink)}
                postFeedHandler={postFeedHandler}
                threadLink={threadLink}
                onCancel={onThreadPanelClose}
              />
            ) : null}
            {selectedField ? (
              <RequestDescriptionModal
                createThread={createThread}
                defaultValue={getDefaultValue(
                  serviceDetails?.owner as EntityReference
                )}
                header="Request description"
                threadLink={getEntityFeedLink(
                  serviceCategory.slice(0, -1),
                  serviceFQN,
                  selectedField
                )}
                onCancel={closeRequestModal}
              />
            ) : null}
          </div>
        </PageContainer>
      )}
    </>
  );
};

export default ServicePage;
