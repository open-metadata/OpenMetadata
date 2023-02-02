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

import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Popover, Table, Tooltip, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import cronstrue from 'cronstrue';
import { isEmpty, isNil, lowerCase, startCase } from 'lodash';
import React, { Fragment, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { PAGE_SIZE } from '../../constants/constants';
import { WORKFLOWS_METADATA_DOCS } from '../../constants/docs.constants';
import { PIPELINE_TYPE_LOCALIZATION } from '../../constants/Ingestions.constant';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import { Connection } from '../../generated/entity/services/databaseService';
import {
  IngestionPipeline,
  PipelineType,
} from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Connection as MetadataConnection } from '../../generated/entity/services/metadataService';
import { getLoadingStatus } from '../../utils/CommonUtils';
import {
  getAddIngestionPath,
  getEditIngestionPath,
  getLogsViewerPath,
} from '../../utils/RouterUtils';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import ErrorPlaceHolder from '../common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../common/next-previous/NextPrevious';
import Searchbar from '../common/searchbar/Searchbar';
import DropDownList from '../dropdown/DropDownList';
import Loader from '../Loader/Loader';
import EntityDeleteModal from '../Modals/EntityDeleteModal/EntityDeleteModal';
import KillIngestionModal from '../Modals/KillIngestionPipelineModal/KillIngestionPipelineModal';
import { usePermissionProvider } from '../PermissionProvider/PermissionProvider';
import {
  IngestionServicePermission,
  ResourceEntity,
} from '../PermissionProvider/PermissionProvider.interface';
import { IngestionProps } from './ingestion.interface';
import { IngestionRecentRuns } from './IngestionRecentRun/IngestionRecentRuns.component';

const Ingestion: React.FC<IngestionProps> = ({
  airflowEndpoint,
  serviceName,
  serviceCategory,
  serviceDetails,
  ingestionList,
  isRequiredDetailsAvailable,
  deleteIngestion,
  triggerIngestion,
  deployIngestion,
  paging,
  pagingHandler,
  handleEnableDisableIngestion,
  currrentPage,
  onIngestionWorkflowsUpdate,
  permissions,
}: IngestionProps) => {
  const history = useHistory();
  const { t } = useTranslation();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [searchText, setSearchText] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [currTriggerId, setCurrTriggerId] = useState({ id: '', state: '' });
  const [currDeployId, setCurrDeployId] = useState({ id: '', state: '' });
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<IngestionPipeline>();
  const [deleteSelection, setDeleteSelection] = useState({
    id: '',
    name: '',
    state: '',
  });
  const [isKillModalOpen, setIsKillModalOpen] = useState<boolean>(false);
  const isOpenmetadataService = useMemo(
    () =>
      serviceDetails.connection?.config?.type ===
      MetadataServiceType.OpenMetadata,
    [serviceDetails]
  );

  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
  };

  const [ingestionData, setIngestionData] =
    useState<Array<IngestionPipeline>>(ingestionList);
  const [servicePermission, setServicePermission] =
    useState<IngestionServicePermission>();

  const fetchServicePermission = async () => {
    try {
      const promises = ingestionList.map((item) =>
        getEntityPermissionByFqn(ResourceEntity.INGESTION_PIPELINE, item.name)
      );
      const response = await Promise.allSettled(promises);

      const permissionData = response.reduce((acc, cv, index) => {
        return {
          ...acc,
          [ingestionList?.[index].name]:
            cv.status === 'fulfilled' ? cv.value : {},
        };
      }, {});

      setServicePermission(permissionData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const getEditPermission = (service: string): boolean =>
    !servicePermission?.[service]?.EditAll;

  const getSupportedPipelineTypes = () => {
    let pipelineType = [];
    const config = serviceDetails.connection?.config as Connection;
    if (config) {
      config.supportsMetadataExtraction &&
        pipelineType.push(PipelineType.Metadata);
      config.supportsUsageExtraction && pipelineType.push(PipelineType.Usage);
      config.supportsUsageExtraction && pipelineType.push(PipelineType.Lineage);
      config.supportsProfiler && pipelineType.push(PipelineType.Profiler);
      config.supportsDBTExtraction && pipelineType.push(PipelineType.Dbt);
      (config as MetadataConnection).supportsDataInsightExtraction &&
        pipelineType.push(PipelineType.DataInsight);
      (config as MetadataConnection)
        .supportsElasticSearchReindexingExtraction &&
        pipelineType.push(PipelineType.ElasticSearchReindex);
    } else {
      pipelineType = [
        PipelineType.Metadata,
        PipelineType.Usage,
        PipelineType.Lineage,
        PipelineType.Profiler,
        PipelineType.Dbt,
      ];
    }

    return pipelineType;
  };

  const getIngestionPipelineTypeOption = (): PipelineType[] => {
    const pipelineType = getSupportedPipelineTypes();
    if (isOpenmetadataService || ingestionList.length > 0) {
      return pipelineType.reduce((prev, curr) => {
        if (
          // Prevent adding multiple usage pipeline
          curr === PipelineType.Usage &&
          ingestionList.find((d) => d.pipelineType === curr)
        ) {
          return prev;
        } else {
          return [...prev, curr];
        }
      }, [] as PipelineType[]);
    }

    return [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
      PipelineType.Profiler,
      PipelineType.Dbt,
    ];
  };

  const handleTriggerIngestion = (id: string, displayName: string) => {
    setCurrTriggerId({ id, state: 'waiting' });
    triggerIngestion(id, displayName)
      .then(() => {
        setCurrTriggerId({ id, state: 'success' });
        setTimeout(() => {
          setCurrTriggerId({ id: '', state: '' });
          showSuccessToast(t('message.pipeline-trigger-success-message'));
        }, 1500);
      })
      .catch(() => setCurrTriggerId({ id: '', state: '' }));
  };

  const handleDeployIngestion = (id: string) => {
    setCurrDeployId({ id, state: 'waiting' });
    deployIngestion(id)
      .then(() => {
        setCurrDeployId({ id, state: 'success' });
        setTimeout(() => setCurrDeployId({ id: '', state: '' }), 1500);
      })
      .catch(() => setCurrDeployId({ id: '', state: '' }));
  };

  const handleCancelConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({
      id: '',
      name: '',
      state: '',
    });
  };

  const handleUpdate = (ingestion: IngestionPipeline) => {
    history.push(
      getEditIngestionPath(
        serviceCategory,
        serviceName,
        ingestion.fullyQualifiedName || `${serviceName}.${ingestion.name}`,
        ingestion.pipelineType
      )
    );
  };

  const handleDelete = (id: string, displayName: string) => {
    setDeleteSelection({ id, name: displayName, state: 'waiting' });
    deleteIngestion(id, displayName)
      .then(() => {
        setTimeout(() => {
          setDeleteSelection({ id, name: displayName, state: 'success' });
          handleCancelConfirmationModal();
        }, 500);
      })
      .catch(() => {
        handleCancelConfirmationModal();
      });
  };

  const ConfirmDelete = (id: string, name: string) => {
    setDeleteSelection({
      id,
      name,
      state: '',
    });
    setIsConfirmationModalOpen(true);
  };

  const handleAddIngestionClick = (type?: PipelineType) => {
    setShowActions(false);
    if (type) {
      history.push(getAddIngestionPath(serviceCategory, serviceName, type));
    }
  };

  const isDataSightIngestionExists = useMemo(
    () =>
      ingestionData.some(
        (ingestion) => ingestion.pipelineType === PipelineType.DataInsight
      ),
    [ingestionData]
  );

  const getAddIngestionButton = (type: PipelineType) => {
    return (
      <Button
        className={classNames('h-8 rounded-4 m-b-xs')}
        data-testid="add-new-ingestion-button"
        size="small"
        type="primary"
        onClick={() => handleAddIngestionClick(type)}>
        {t('label.add-workflow-ingestion', { workflow: startCase(type) })}
      </Button>
    );
  };

  const getAddIngestionName = (type: PipelineType): string => {
    let name;
    switch (type) {
      case PipelineType.ElasticSearchReindex:
        name = t('label.add-workflow-ingestion', {
          workflow: t('label.elastic-search-re-index'),
        });

        break;

      case PipelineType.Dbt:
        name = t('label.add-workflow-ingestion', {
          workflow: t('label.dbt-lowercase'),
        });

        break;

      default:
        name = t('label.add-workflow-ingestion', {
          workflow: t(`label.${PIPELINE_TYPE_LOCALIZATION[type]}`),
        });
    }

    return name;
  };

  const getAddIngestionDropdown = (types: PipelineType[]) => {
    return (
      <Fragment>
        <Button
          className={classNames('h-8 rounded-4 m-b-xs d-flex items-center')}
          data-testid="add-new-ingestion-button"
          disabled={!permissions.Create}
          size="small"
          type="primary"
          onClick={() => setShowActions((pre) => !pre)}>
          {t('label.add-entity', { entity: t('label.ingestion-lowercase') })}
          {showActions ? (
            <DropdownIcon
              style={{
                transform: 'rotate(180deg)',
                verticalAlign: 'middle',
                color: '#fff',
              }}
            />
          ) : (
            <DropdownIcon
              style={{
                color: '#fff',
                verticalAlign: 'middle',
              }}
            />
          )}
        </Button>
        {showActions && (
          <DropDownList
            horzPosRight
            dropDownList={types.map((type) => ({
              name: getAddIngestionName(type),
              disabled:
                type === PipelineType.DataInsight
                  ? isDataSightIngestionExists
                  : false,
              value: type,
            }))}
            onSelect={(_e, value) =>
              handleAddIngestionClick(value as PipelineType)
            }
          />
        )}
      </Fragment>
    );
  };

  const getAddIngestionElement = () => {
    const types = getIngestionPipelineTypeOption();
    let element: JSX.Element | null = null;
    // Check if service has atleast one metadata pipeline available or not
    const hasMetadata = ingestionList.find(
      (ingestion) => ingestion.pipelineType === PipelineType.Metadata
    );

    if (types.length) {
      // if service has metedata then show all available option
      if (isOpenmetadataService || hasMetadata) {
        element = getAddIngestionDropdown(types);
      } else {
        /**
         * If service does not have any metedata pipeline then
         * show only option for metadata ingestion
         */
        element = getAddIngestionButton(PipelineType.Metadata);
      }
    }

    return element;
  };

  const getSearchedIngestions = () => {
    const sText = lowerCase(searchText);

    setIngestionData(
      sText
        ? ingestionList.filter(
            (ing) =>
              lowerCase(ing.displayName).includes(sText) ||
              lowerCase(ing.name).includes(sText)
          )
        : ingestionList
    );
  };

  useEffect(() => {
    getSearchedIngestions();
  }, [searchText, ingestionList]);

  useEffect(() => {
    fetchServicePermission();
  }, []);

  const separator = (
    <span className="tw-inline-block tw-text-gray-400 tw-self-center">|</span>
  );

  const getIngestionPermission = (name: string): boolean =>
    !isRequiredDetailsAvailable || getEditPermission(name);

  const getTriggerDeployButton = (ingestion: IngestionPipeline) => {
    if (ingestion.deployed) {
      return (
        <>
          <Button
            data-testid="run"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() =>
              handleTriggerIngestion(ingestion.id as string, ingestion.name)
            }>
            {getLoadingStatus(currTriggerId, ingestion.id, t('label.run'))}
          </Button>
          {separator}

          <Button
            data-testid="re-deploy-btn"
            disabled={getIngestionPermission(ingestion.name)}
            type="link"
            onClick={() => handleDeployIngestion(ingestion.id as string)}>
            {getLoadingStatus(currDeployId, ingestion.id, t('label.re-deploy'))}
          </Button>
        </>
      );
    } else {
      return (
        <Button
          data-testid="deploy"
          disabled={getIngestionPermission(ingestion.name)}
          type="link"
          onClick={() => handleDeployIngestion(ingestion.id as string)}>
          {getLoadingStatus(currDeployId, ingestion.id, t('label.deploy'))}
        </Button>
      );
    }
  };

  const tableColumn: ColumnsType<IngestionPipeline> = useMemo(
    () => [
      {
        title: t('label.name'),
        dataIndex: 'name',
        key: 'name',
        render: (text) =>
          airflowEndpoint ? (
            <Tooltip
              title={
                permissions.ViewAll || permissions.ViewBasic
                  ? t('label.view-entity', {
                      entity: t('label.dag'),
                    })
                  : t('message.no-permission-to-view')
              }>
              <Button
                className="tw-mr-2"
                data-testid="airflow-tree-view"
                disabled={!(permissions.ViewAll || permissions.ViewBasic)}
                href={`${airflowEndpoint}/tree?dag_id=${text}`}
                rel="noopener noreferrer"
                target="_blank"
                type="link">
                {text}
                <SVGIcons
                  alt="external-link"
                  className="tw-align-middle tw-ml-1"
                  icon={Icons.EXTERNAL_LINK}
                  width="16px"
                />
              </Button>
            </Tooltip>
          ) : (
            text
          ),
      },
      {
        title: t('label.type'),
        dataIndex: 'pipelineType',
        key: 'pipelineType',
      },
      {
        title: t('label.schedule'),
        dataIndex: 'schedule',
        key: 'schedule',
        render: (_, record) =>
          record.airflowConfig?.scheduleInterval ? (
            <Popover
              content={
                <div>
                  {cronstrue.toString(
                    record.airflowConfig.scheduleInterval || '',
                    {
                      use24HourTimeFormat: true,
                      verbose: true,
                    }
                  )}
                </div>
              }
              placement="bottom"
              trigger="hover">
              <span>{record.airflowConfig.scheduleInterval ?? '--'}</span>
            </Popover>
          ) : (
            <span>--</span>
          ),
      },
      {
        title: t('label.recent-run-plural'),
        dataIndex: 'recentRuns',
        key: 'recentRuns',
        width: 180,
        render: (_, record) => (
          <IngestionRecentRuns classNames="align-middle" ingestion={record} />
        ),
      },
      {
        title: t('label.action-plural'),
        dataIndex: 'actions',
        key: 'actions',
        render: (_, record) => (
          <div>
            <div className="tw-flex">
              {record.enabled ? (
                <Fragment>
                  {getTriggerDeployButton(record)}
                  {separator}
                  <Button
                    data-testid="pause"
                    disabled={getIngestionPermission(record.name)}
                    type="link"
                    onClick={() =>
                      handleEnableDisableIngestion(record.id || '')
                    }>
                    {t('label.pause')}
                  </Button>
                </Fragment>
              ) : (
                <Button
                  data-testid="unpause"
                  disabled={getIngestionPermission(record.name)}
                  type="link"
                  onClick={() => handleEnableDisableIngestion(record.id || '')}>
                  {t('label.unpause')}
                </Button>
              )}
              {separator}
              <Button
                data-testid="edit"
                disabled={getIngestionPermission(record.name)}
                type="link"
                onClick={() => handleUpdate(record)}>
                {t('label.edit')}
              </Button>
              {separator}
              <Button
                data-testid="delete"
                disabled={!servicePermission?.[record.name]?.Delete}
                type="link"
                onClick={() => ConfirmDelete(record.id as string, record.name)}>
                {deleteSelection.id === record.id ? (
                  deleteSelection.state === 'success' ? (
                    <FontAwesomeIcon icon="check" />
                  ) : (
                    <Loader size="small" type="default" />
                  )
                ) : (
                  t('label.delete')
                )}
              </Button>
              {separator}
              <Button
                data-testid="kill"
                disabled={getIngestionPermission(record.name)}
                type="link"
                onClick={() => {
                  setIsKillModalOpen(true);
                  setSelectedPipeline(record);
                }}>
                {t('label.kill')}
              </Button>
              {separator}
              <Button
                data-testid="logs"
                disabled={!isRequiredDetailsAvailable}
                href={getLogsViewerPath(
                  serviceCategory,
                  record.service?.name || '',
                  record?.fullyQualifiedName || record?.name || ''
                )}
                type="link"
                onClick={() => {
                  setSelectedPipeline(record);
                }}>
                {t('label.log-plural')}
              </Button>
            </div>
            {isKillModalOpen &&
              selectedPipeline &&
              record.id === selectedPipeline?.id && (
                <KillIngestionModal
                  isModalOpen={isKillModalOpen}
                  pipelinName={selectedPipeline.name}
                  pipelineId={selectedPipeline.id as string}
                  onClose={() => {
                    setIsKillModalOpen(false);
                    setSelectedPipeline(undefined);
                  }}
                  onIngestionWorkflowsUpdate={onIngestionWorkflowsUpdate}
                />
              )}
          </div>
        ),
      },
    ],
    [
      permissions,
      airflowEndpoint,
      getTriggerDeployButton,
      isRequiredDetailsAvailable,
      handleEnableDisableIngestion,
      ConfirmDelete,
      handleUpdate,
      deleteSelection,
      setIsKillModalOpen,
      setSelectedPipeline,
      getLogsViewerPath,
      serviceCategory,
      isKillModalOpen,
      selectedPipeline,
      onIngestionWorkflowsUpdate,
    ]
  );

  const getIngestionTab = () => {
    return (
      <div className="mt-4" data-testid="ingestion-details-container">
        <div className="d-flex">
          {!isRequiredDetailsAvailable && (
            <div className="tw-rounded tw-bg-error-lite tw-text-error tw-font-medium tw-px-4 tw-py-1 tw-mb-4 tw-flex tw-items-center tw-gap-1">
              <FontAwesomeIcon icon={faExclamationCircle} />
              <p>
                {t('message.no-service-connection-details-message', {
                  serviceName,
                })}
              </p>
            </div>
          )}
        </div>
        <div className="tw-flex tw-justify-between">
          <div className="tw-w-4/12">
            {searchText || !isEmpty(ingestionData) ? (
              <Searchbar
                placeholder={`${t('message.search-for-ingestion')}...`}
                searchValue={searchText}
                typingInterval={500}
                onSearch={handleSearchAction}
              />
            ) : null}
          </div>
          <div className="tw-relative">
            {isRequiredDetailsAvailable &&
              permissions.EditAll &&
              getAddIngestionElement()}
          </div>
        </div>
        {!isEmpty(ingestionData) ? (
          <div className="tw-mb-6" data-testid="ingestion-table">
            <Table
              bordered
              className="table-shadow"
              columns={tableColumn}
              data-testid="schema-table"
              dataSource={ingestionData}
              pagination={false}
              rowKey="name"
              size="small"
            />

            {Boolean(!isNil(paging.after) || !isNil(paging.before)) && (
              <NextPrevious
                currentPage={currrentPage}
                pageSize={PAGE_SIZE}
                paging={paging}
                pagingHandler={pagingHandler}
                totalCount={paging.total}
              />
            )}
          </div>
        ) : (
          isRequiredDetailsAvailable &&
          ingestionList.length === 0 && (
            <ErrorPlaceHolder>
              <Typography.Text>
                {t('message.no-ingestion-available')}
              </Typography.Text>
              <Typography.Text>
                {t('message.no-ingestion-description')}
              </Typography.Text>
              <Typography.Link href={WORKFLOWS_METADATA_DOCS} target="_blank">
                {t('label.metadata-ingestion')}
              </Typography.Link>
            </ErrorPlaceHolder>
          )
        )}
      </div>
    );
  };

  return (
    <div data-testid="ingestion-container">
      {getIngestionTab()}
      <EntityDeleteModal
        entityName={deleteSelection.name}
        entityType={t('label.ingestion-lowercase')}
        loadingState={deleteSelection.state}
        visible={isConfirmationModalOpen}
        onCancel={handleCancelConfirmationModal}
        onConfirm={() => handleDelete(deleteSelection.id, deleteSelection.name)}
      />
    </div>
  );
};

export default Ingestion;
