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
import TestConnection from 'components/common/TestConnection/TestConnection';
import TitleBreadcrumb from 'components/common/title-breadcrumb/title-breadcrumb.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Ingestion from 'components/Ingestion/Ingestion.component';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import ServiceConnectionDetails from 'components/ServiceConnectionDetails/ServiceConnectionDetails.component';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { EntityType } from 'enums/entity.enum';
import { compare } from 'fast-json-patch';
import { Container } from 'generated/entity/data/container';
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
import { getMlModels } from 'rest/mlModelAPI';
import { getContainers } from 'rest/objectStoreAPI';
import { getPipelines } from 'rest/pipelineAPI';
import {
  getServiceByFQN,
  updateOwnerService,
  updateService,
} from 'rest/serviceAPI';
import { getTopics } from 'rest/topicsAPI';
import { getEntityName } from 'utils/EntityUtils';
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
  getServiceCategoryFromType,
  getServicePageTabs,
  getServiceRouteFromServiceType,
  servicePageTabs,
  serviceTypeLogo,
  setServiceSchemaCount,
  setServiceTableCount,
  shouldTestConnection,
} from '../../utils/ServiceUtils';
import { IcDeleteColored } from '../../utils/SvgUtils';
import { getEntityLink, getUsagePercentile } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';

export type ServicePageData =
  | Database
  | Topic
  | Dashboard
  | Mlmodel
  | Pipeline
  | Container;

const ServicePage: FunctionComponent = () => {
  const { t } = useTranslation();
  const { isAirflowAvailable } = useAirflowStatus();
  const { serviceFQN, serviceType, serviceCategory, tab } =
    useParams() as Record<string, string>;

  const isOpenMetadataService = useMemo(
    () => serviceFQN === OPENMETADATA,
    [serviceFQN]
  );

  const [serviceName, setServiceName] = useState<ServiceTypes>(
    (serviceCategory as ServiceTypes) || getServiceCategoryFromType(serviceType)
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
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [activeTab, setActiveTab] = useState(
    getCurrentServiceTab(tab, serviceName)
  );
  const [isError, setIsError] = useState(isOpenMetadataService);
  const [ingestions, setIngestions] = useState<IngestionPipeline[]>([]);
  const [serviceList] = useState<Array<DatabaseService>>([]);
  const [ingestionPaging, setIngestionPaging] = useState<Paging>({} as Paging);

  const [currentPage, setCurrentPage] = useState(1);
  const [airflowEndpoint, setAirflowEndpoint] = useState<string>();
  const [connectionDetails, setConnectionDetails] = useState<ConfigData>();

  const [schemaCount, setSchemaCount] = useState<number>(0);
  const [tableCount, setTableCount] = useState<number>(0);

  const [deleteWidgetVisible, setDeleteWidgetVisible] = useState(false);
  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

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
        paging.total,
        ingestions,
        servicePermission
      ),
    [serviceName, paging, ingestions, servicePermission]
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
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  const fetchTopics = async (paging?: PagingWithoutTotal) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  const fetchDashboards = async (paging?: PagingWithoutTotal) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  const fetchPipeLines = async (paging?: PagingWithoutTotal) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  const fetchMlModal = async (paging?: PagingWithoutTotal) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  const fetchContainers = async (paging?: PagingWithoutTotal) => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  };

  const getOtherDetails = (paging?: PagingWithoutTotal) => {
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
      case ServiceCategory.OBJECT_STORE_SERVICES: {
        fetchContainers(paging);

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

      case ServiceCategory.OBJECT_STORE_SERVICES:
        return getEntityLink(EntityType.CONTAINER, fqn);

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
      case ServiceCategory.OBJECT_STORE_SERVICES: {
        const container = data as Container;

        return container.tags && container.tags.length > 0 ? (
          <TagsViewer
            showStartWith={false}
            sizeCap={-1}
            tags={container.tags}
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
    if (isUndefined(owner)) {
      handleRemoveOwner();

      return;
    }
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
              t('server.entity-updating-error', {
                entity: t('label.owner-lowercase'),
              })
            );
          }

          return reject();
        })
        .catch((error: AxiosError) => {
          showErrorToast(
            error,
            t('server.entity-updating-error', {
              entity: t('label.owner-lowercase'),
            })
          );

          return reject();
        });
    });
  };

  const handleRemoveOwner = async () => {
    const updatedData = {
      ...serviceDetails,
      owner: undefined,
    } as ServicesUpdateRequest;

    const jsonPatch = compare(serviceDetails || {}, updatedData);
    try {
      const res = await updateOwnerService(
        serviceName,
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
            deleteIngestion={deleteIngestionById}
            deployIngestion={deployIngestion}
            handleEnableDisableIngestion={handleEnableDisableIngestion}
            ingestionList={ingestions}
            paging={ingestionPaging}
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
    if (!isOpenMetadataService) {
      fetchServicePermission();
    }
  }, [serviceFQN, serviceCategory]);

  const tableColumn: ColumnsType<ServicePageData> = useMemo(() => {
    const lastColumn =
      ServiceCategory.DATABASE_SERVICES === serviceName
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
  }, [serviceName]);

  useEffect(() => {
    if (isAirflowAvailable && !isOpenMetadataService) {
      getAllIngestionWorkflows();
    }
  }, [isAirflowAvailable]);

  const isTestingDisabled =
    !servicePermission.EditAll ||
    (serviceCategory === ServiceCategory.METADATA_SERVICES &&
      serviceFQN === OPENMETADATA) ||
    isUndefined(connectionDetails);

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
                      paging.total,
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
                            <TestConnection
                              connectionType={serviceDetails?.serviceType ?? ''}
                              formData={connectionDetails as ConfigData}
                              isTestingDisabled={isTestingDisabled}
                              serviceCategory={
                                serviceCategory as ServiceCategory
                              }
                              serviceName={serviceDetails?.name}
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
