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

import {
  Button,
  Col,
  Row,
  Space,
  Switch,
  Tabs,
  TabsProps,
  Tooltip,
  Typography,
} from 'antd';
import Table, { ColumnsType } from 'antd/lib/table';
import AppState from 'AppState';
import { AxiosError } from 'axios';
import AirflowMessageBanner from 'components/common/AirflowMessageBanner/AirflowMessageBanner';
import DescriptionV1 from 'components/common/description/DescriptionV1';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import ErrorPlaceHolderIngestion from 'components/common/error-with-placeholder/ErrorPlaceHolderIngestion';
import NextPrevious from 'components/common/next-previous/NextPrevious';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from 'components/common/rich-text-editor/RichTextEditorPreviewer';
import TestConnection from 'components/common/TestConnection/TestConnection';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import { DataAssetsHeader } from 'components/DataAssets/DataAssetsHeader/DataAssetsHeader.component';
import DataModelTable from 'components/DataModels/DataModelsTable';
import Ingestion from 'components/Ingestion/Ingestion.component';
import Loader from 'components/Loader/Loader';
import { EntityName } from 'components/Modals/EntityNameModal/EntityNameModal.interface';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { OperationPermission } from 'components/PermissionProvider/PermissionProvider.interface';
import ServiceConnectionDetails from 'components/ServiceConnectionDetails/ServiceConnectionDetails.component';
import TabsLabel from 'components/TabsLabel/TabsLabel.component';
import TagsContainerV2 from 'components/Tag/TagsContainerV2/TagsContainerV2';
import TagsViewer from 'components/Tag/TagsViewer/tags-viewer';
import { ERROR_PLACEHOLDER_TYPE } from 'enums/common.enum';
import { EntityTabs, EntityType } from 'enums/entity.enum';
import { compare, Operation } from 'fast-json-patch';
import { Container } from 'generated/entity/data/container';
import { DashboardDataModel } from 'generated/entity/data/dashboardDataModel';
import { Include } from 'generated/type/include';
import { LabelType, State, TagSource } from 'generated/type/tagLabel';
import { useAuth } from 'hooks/authHooks';
import { isEmpty, isNil, isUndefined, toLower } from 'lodash';
import {
  EntityTags,
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
import { Link, useHistory, useParams } from 'react-router-dom';
import {
  getDashboards,
  getDataModels,
  ListDataModelParams,
} from 'rest/dashboardAPI';
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
  NO_DATA_PLACEHOLDER,
  PAGE_SIZE,
  pagingObject,
} from '../../constants/constants';
import { OPEN_METADATA } from '../../constants/Services.constant';
import { SearchIndex } from '../../enums/search.enum';
import { ServiceCategory } from '../../enums/service.enum';
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
import { getEditConnectionPath } from '../../utils/RouterUtils';
import {
  getCountLabel,
  getResourceEntityFromServiceCategory,
  shouldTestConnection,
} from '../../utils/ServiceUtils';
import {
  getEntityLink,
  getTagsWithoutTier,
  getTierTags,
  getUsagePercentile,
} from '../../utils/TableUtils';
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

  const activeTab = useMemo(() => {
    if (tab) {
      return tab;
    }
    if (serviceCategory === ServiceCategory.METADATA_SERVICES) {
      return EntityTabs.INGESTIONS;
    }

    return getCountLabel(serviceCategory).toLowerCase();
  }, [tab, serviceCategory]);

  const isOpenMetadataService = useMemo(
    () => serviceFQN === OPEN_METADATA,
    [serviceFQN]
  );

  const { getEntityPermissionByFqn } = usePermissionProvider();
  const history = useHistory();
  const { isAdminUser } = useAuth();

  const [isEdit, setIsEdit] = useState(false);
  const [description, setDescription] = useState('');
  const [serviceDetails, setServiceDetails] = useState<ServicesType>(
    {} as ServicesType
  );
  const [data, setData] = useState<Array<ServicePageData>>([]);
  const [isLoading, setIsLoading] = useState(!isOpenMetadataService);
  const [isServiceLoading, setIsServiceLoading] = useState(true);
  const [dataModel, setDataModel] = useState<Array<ServicePageData>>([]);
  const [dataModelPaging, setDataModelPaging] = useState<Paging>(pagingObject);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [isError, setIsError] = useState(isOpenMetadataService);
  const [ingestions, setIngestions] = useState<IngestionPipeline[]>([]);
  const [serviceList] = useState<Array<DatabaseService>>([]);
  const [ingestionPaging, setIngestionPaging] = useState<Paging>({} as Paging);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [dataModelCurrentPage, setDataModelCurrentPage] = useState(1);
  const [airflowEndpoint, setAirflowEndpoint] = useState<string>();
  const [connectionDetails, setConnectionDetails] = useState<ConfigData>();

  const [servicePermission, setServicePermission] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);

  const tier = getTierTags(serviceDetails?.tags ?? []);
  const tags = getTagsWithoutTier(serviceDetails?.tags ?? []);

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

  const activeTabHandler = (key: string) => {
    if (key !== activeTab) {
      history.push({
        pathname: getServiceDetailsPath(serviceFQN, serviceCategory, key),
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

  const include = useMemo(
    () => (showDeleted ? Include.Deleted : Include.NonDeleted),
    [showDeleted]
  );

  const fetchDatabases = async (paging?: PagingWithoutTotal) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getDatabases(
        serviceFQN,
        'owner,usageSummary',
        paging,
        include
      );

      setData(data);
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
        paging,
        include
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
        paging,
        include
      );
      setData(data);
      setPaging(resPaging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsServiceLoading(false);
    }
  };

  const fetchDashboardsDataModel = async (params?: ListDataModelParams) => {
    setIsServiceLoading(true);
    try {
      const { data, paging: resPaging } = await getDataModels({
        service: serviceFQN,
        fields: 'owner,tags,followers',
        include,
        ...params,
      });
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
        paging,
        include
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
        paging,
        include
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
        include,
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
        if (isDataModel) {
          fetchDashboardsDataModel({ ...paging });
        } else {
          fetchDashboards(paging);
        }

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
    getOtherDetails(undefined, activeTab === EntityTabs.DATA_Model);
  }, [activeTab, showDeleted]);

  useEffect(() => {
    // fetch count for data modal tab, its need only when its dashboard page and data modal tab is not active
    if (
      serviceCategory === ServiceCategory.DASHBOARD_SERVICES &&
      activeTab !== EntityTabs.DATA_Model
    ) {
      fetchDashboardsDataModel({ limit: 0 });
    }
  }, []);

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

  const handleUpdateDisplayName = async (data: EntityName) => {
    if (isEmpty(serviceDetails)) {
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
        if (isEmpty(pre)) {
          return {} as ServicesType;
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

  const onDescriptionEdit = (): void => {
    setIsEdit(true);
  };

  const onCancel = () => {
    setIsEdit(false);
  };

  const onDescriptionUpdate = async (updatedHTML: string) => {
    if (description !== updatedHTML && !isEmpty(serviceDetails)) {
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
          entity: t('label.owner-lowercase'),
        })
      );
    }
  };

  const saveUpdatedServiceData = async (updatedData: ServicesType) => {
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
      // Error
    }
  };

  const handleUpdateTier = useCallback(
    async (newTier?: string) => {
      const tierTag = newTier
        ? [
            ...getTagsWithoutTier(serviceDetails?.tags ?? []),
            {
              tagFQN: newTier,
              labelType: LabelType.Manual,
              state: State.Confirmed,
            },
          ]
        : getTagsWithoutTier(serviceDetails?.tags ?? []);
      const updatedServiceDetails = {
        ...serviceDetails,
        tags: tierTag,
      };

      return saveUpdatedServiceData(updatedServiceDetails);
    },
    [saveUpdatedServiceData, serviceDetails]
  );

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
    } else if (isUndefined(airflowEndpoint) || isEmpty(serviceDetails)) {
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
      <Row>
        <Col span={24}>
          <Row justify="end">
            <Col>
              <Switch
                checked={showDeleted}
                data-testid="show-deleted"
                onClick={setShowDeleted}
              />
              <Typography.Text className="m-l-xs">
                {t('label.deleted')}
              </Typography.Text>{' '}
            </Col>
          </Row>
        </Col>

        <DataModelTable
          currentPage={dataModelCurrentPage}
          data={dataModel}
          isLoading={isServiceLoading}
          paging={dataModelPaging}
          pagingHandler={dataModelPagingHandler}
        />
      </Row>
    ),
    [dataModel, isServiceLoading, dataModelPagingHandler, dataModelCurrentPage]
  );

  const testConnectionTab = useMemo(() => {
    return (
      <>
        <Row className="my-4">
          <Col span={12}>
            <AirflowMessageBanner />
          </Col>
          <Col span={12}>
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
          </Col>
        </Row>
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
      ...(ServiceCategory.PIPELINE_SERVICES === serviceCategory
        ? [
            {
              title: t('label.schedule-interval'),
              dataIndex: 'scheduleInterval',
              key: 'scheduleInterval',
              render: (scheduleInterval: Pipeline['scheduleInterval']) =>
                scheduleInterval ? (
                  <span>{scheduleInterval}</span>
                ) : (
                  <Typography.Text>{NO_DATA_PLACEHOLDER}</Typography.Text>
                ),
            },
          ]
        : []),
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
        <Col data-testid="table-container" span={24}>
          <Table
            bordered
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
        </Col>
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

  const entityType = useMemo(() => {
    switch (serviceCategory) {
      case ServiceCategory.DASHBOARD_SERVICES:
        return EntityType.DASHBOARD_SERVICE;
      case ServiceCategory.MESSAGING_SERVICES:
        return EntityType.MESSAGING_SERVICE;
      case ServiceCategory.PIPELINE_SERVICES:
        return EntityType.PIPELINE_SERVICE;
      case ServiceCategory.ML_MODEL_SERVICES:
        return EntityType.MLMODEL_SERVICE;
      case ServiceCategory.METADATA_SERVICES:
        return EntityType.METADATA_SERVICE;
      case ServiceCategory.STORAGE_SERVICES:
        return EntityType.STORAGE_SERVICE;
      case ServiceCategory.DATABASE_SERVICES:
      default:
        return EntityType.DATABASE_SERVICE;
    }
  }, [serviceCategory]);

  /**
   * Formulates updated tags and updates table entity data for API call
   * @param selectedTags
   */
  const onTagUpdate = async (selectedTags?: Array<EntityTags>) => {
    if (selectedTags) {
      const updatedTags = [...(tier ? [tier] : []), ...selectedTags];
      const updatedTable = { ...serviceDetails, tags: updatedTags };
      await saveUpdatedServiceData(updatedTable);
    }
  };

  const handleTagSelection = async (selectedTags: EntityTags[]) => {
    if (selectedTags) {
      const prevTags =
        tags?.filter((tag) =>
          selectedTags
            .map((selTag) => selTag.tagFQN)
            .includes(tag?.tagFQN as string)
        ) || [];
      const newTags = selectedTags
        .filter((tag) => {
          return !prevTags
            ?.map((prevTag) => prevTag.tagFQN)
            .includes(tag.tagFQN);
        })
        .map((tag) => ({
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: tag.source,
          tagFQN: tag.tagFQN,
        }));
      await onTagUpdate([...prevTags, ...newTags]);
    }
  };

  const editTagsPermission = useMemo(
    () => servicePermission.EditTags || servicePermission.EditAll,
    [servicePermission, serviceDetails]
  );

  const getServicePageTabs = (
    serviceName: ServiceTypes,
    instanceCount: number,
    ingestionCount: number,
    servicePermission: OperationPermission,
    dataModelCount: number,
    showIngestionTab: boolean
  ) => {
    const tabs = [];

    if (serviceName !== ServiceCategory.METADATA_SERVICES) {
      tabs.push({
        name: getCountLabel(serviceName),
        key: getCountLabel(serviceName).toLowerCase(),
        count: instanceCount,
        children: (
          <Row gutter={[0, 16]} wrap={false}>
            <Col className="p-t-sm m-x-lg" flex="auto">
              <Row gutter={[16, 16]}>
                <Col data-testid="description-container" span={24}>
                  <DescriptionV1
                    description={description}
                    entityFqn={serviceFQN}
                    entityName={serviceName}
                    entityType={entityType}
                    hasEditAccess={
                      servicePermission.EditDescription ||
                      servicePermission.EditAll
                    }
                    isEdit={isEdit}
                    onCancel={onCancel}
                    onDescriptionEdit={onDescriptionEdit}
                    onDescriptionUpdate={onDescriptionUpdate}
                  />
                </Col>
                <Col span={24}>
                  <Row justify="end">
                    <Col>
                      <Switch
                        checked={showDeleted}
                        data-testid="show-deleted"
                        onClick={setShowDeleted}
                      />
                      <Typography.Text className="m-l-xs">
                        {t('label.deleted')}
                      </Typography.Text>{' '}
                    </Col>
                  </Row>
                </Col>
                {entityServiceTab}
              </Row>
            </Col>
            <Col
              className="entity-tag-right-panel-container"
              data-testid="entity-right-panel"
              flex="320px">
              <Space className="w-full" direction="vertical" size="large">
                <TagsContainerV2
                  entityFqn={serviceFQN}
                  entityType={entityType}
                  permission={editTagsPermission}
                  selectedTags={tags}
                  tagType={TagSource.Classification}
                  onSelectionChange={handleTagSelection}
                />
                <TagsContainerV2
                  entityFqn={serviceFQN}
                  entityType={entityType}
                  permission={editTagsPermission}
                  selectedTags={tags}
                  tagType={TagSource.Glossary}
                  onSelectionChange={handleTagSelection}
                />
              </Space>
            </Col>
          </Row>
        ),
      });
    }

    if (serviceName === ServiceCategory.DASHBOARD_SERVICES) {
      tabs.push({
        name: t('label.data-model'),
        key: EntityTabs.DATA_Model,
        count: dataModelCount,
        children: dataModalTab,
      });
    }

    tabs.push(
      {
        name: t('label.ingestion-plural'),
        key: EntityTabs.INGESTIONS,
        isHidden: !showIngestionTab,
        count: ingestionCount,
        children: ingestionTab,
      },
      {
        name: t('label.connection'),
        isHidden: !servicePermission.EditAll,
        key: EntityTabs.CONNECTION,
        children: testConnectionTab,
      }
    );

    return tabs.filter((tab) => !tab.isHidden);
  };

  const tabs: TabsProps['items'] = useMemo(() => {
    const isOwner = AppState.userDetails.id === serviceDetails?.owner?.id;
    const showIngestionTab = Boolean(isOwner || isAdminUser);
    const allTabs = getServicePageTabs(
      serviceCategory,
      paging.total,
      ingestionPaging.total,
      servicePermission,
      dataModelPaging.total,
      showIngestionTab
    ).map((tab) => ({
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

    return allTabs;
  }, [
    AppState,
    serviceDetails,
    isAdminUser,
    serviceCategory,
    paging,
    ingestionPaging,
    servicePermission,
    dataModelPaging,
    activeTab,
    getServicePageTabs,
  ]);

  if (isLoading) {
    return <Loader />;
  }

  if (!(servicePermission.ViewAll || servicePermission.ViewBasic)) {
    return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
  }

  return (
    <>
      {isError ? (
        <ErrorPlaceHolder>
          {getEntityMissingError(serviceCategory as string, serviceFQN)}
        </ErrorPlaceHolder>
      ) : (
        <PageLayoutV1
          className="bg-white"
          pageTitle={t('label.entity-detail-plural', {
            entity: getEntityName(serviceDetails),
          })}>
          <Row gutter={[0, 12]}>
            <Col className="p-x-lg" span={24}>
              <DataAssetsHeader
                isRecursiveDelete
                allowSoftDelete={false}
                dataAsset={serviceDetails}
                entityType={entityType}
                permissions={servicePermission}
                onDisplayNameUpdate={handleUpdateDisplayName}
                onOwnerUpdate={handleUpdateOwner}
                onRestoreDataAsset={() => Promise.resolve()}
                onTierUpdate={handleUpdateTier}
              />
            </Col>

            <Col span={24}>
              <Tabs
                activeKey={activeTab}
                className="entity-details-page-tabs"
                data-testid="tabs"
                items={tabs}
                onChange={activeTabHandler}
              />
            </Col>
          </Row>
        </PageLayoutV1>
      )}
    </>
  );
};

export default ServicePage;
