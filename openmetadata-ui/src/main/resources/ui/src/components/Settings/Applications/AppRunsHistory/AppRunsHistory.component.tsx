/*
 *  Copyright 2023 Collate.
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
import validator from '@rjsf/validator-ajv8';
import { Button, Modal, Space, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isNull, noop } from 'lodash';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  NO_DATA_PLACEHOLDER,
  SOCKET_EVENTS,
  STATUS_LABEL,
} from '../../../../constants/constants';
import { GlobalSettingOptions } from '../../../../constants/GlobalSettings.constants';
import { useWebSocketConnector } from '../../../../context/WebSocketProvider/WebSocketProvider';
import { ServiceCategory } from '../../../../enums/service.enum';
import { AppType } from '../../../../generated/entity/applications/app';
import {
  AppRunRecord,
  Status,
} from '../../../../generated/entity/applications/appRunRecord';
import { Paging } from '../../../../generated/type/paging';
import { usePaging } from '../../../../hooks/paging/usePaging';
import { useFqn } from '../../../../hooks/useFqn';
import { getApplicationRuns } from '../../../../rest/applicationAPI';
import { getStatusTypeForApplication } from '../../../../utils/ApplicationUtils';
import {
  formatDateTime,
  formatDurationToHHMMSS,
  getEpochMillisForPastDays,
  getIntervalInMilliseconds,
} from '../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../utils/EntityUtils';
import { getLogsViewerPath } from '../../../../utils/RouterUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FormBuilder from '../../../common/FormBuilder/FormBuilder';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import StatusBadge from '../../../common/StatusBadge/StatusBadge.component';
import { StatusType } from '../../../common/StatusBadge/StatusBadge.interface';
import Table from '../../../common/Table/Table';
import StopScheduleModal from '../../../Modals/StopScheduleRun/StopScheduleRunModal';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';
import AppLogsViewer from '../AppLogsViewer/AppLogsViewer.component';
import './app-run-history.less';
import {
  AppRunRecordWithId,
  AppRunsHistoryProps,
} from './AppRunsHistory.interface';

const AppRunsHistory = forwardRef(
  (
    {
      appData,
      maxRecords,
      jsonSchema,
      showPagination = true,
    }: AppRunsHistoryProps,
    ref
  ) => {
    const { socket } = useWebSocketConnector();
    const { t } = useTranslation();
    const { fqn } = useFqn();
    const [isLoading, setIsLoading] = useState(true);
    const [appRunsHistoryData, setAppRunsHistoryData] = useState<
      AppRunRecordWithId[]
    >([]);
    const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
    const [isStopModalOpen, setIsStopModalOpen] = useState<boolean>(false);
    const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
    const [appRunRecordConfig, setAppRunRecordConfig] = useState<
      AppRunRecord['config']
    >({});
    const UiSchema = {
      ...applicationsClassBase.getJSONUISchema(),
      'ui:submitButtonProps': {
        showButton: false,
        buttonText: 'submit',
      },
    };

    const {
      currentPage,
      paging,
      pageSize,
      handlePagingChange,
      handlePageChange,
      handlePageSizeChange,
      showPagination: paginationVisible,
    } = usePaging();

    const navigate = useNavigate();

    const isExternalApp = useMemo(
      () => appData?.appType === AppType.External,
      [appData]
    );

    const handleRowExpandable = useCallback(
      (key?: string) => {
        if (key) {
          if (isExternalApp && appData) {
            return navigate(
              getLogsViewerPath(
                GlobalSettingOptions.APPLICATIONS,
                appData.name ?? '',
                appData.name ?? ''
              )
            );
          }
          if (expandedRowKeys.includes(key)) {
            setExpandedRowKeys((prev) => prev.filter((item) => item !== key));
          } else {
            setExpandedRowKeys((prev) => [...prev, key]);
          }
        }
      },
      [expandedRowKeys]
    );

    const showLogAction = useCallback((record: AppRunRecordWithId): boolean => {
      if (appData?.appType === AppType.External) {
        return false;
      }

      if (record.status === Status.Success && isNull(record?.successContext)) {
        return true;
      }

      return false;
    }, []);

    const showAppRunConfig = (record: AppRunRecordWithId) => {
      setShowConfigModal(true);
      setAppRunRecordConfig(record.config ?? {});
    };

    const getActionButton = useCallback(
      (record: AppRunRecordWithId) => {
        return (
          <>
            <Button
              className="p-0"
              data-testid="logs"
              disabled={showLogAction(record)}
              size="small"
              type="link"
              onClick={() => handleRowExpandable(record.id)}>
              {t('label.log-plural')}
            </Button>
            <Button
              className="m-l-xs p-0"
              data-testid="app-historical-config"
              size="small"
              type="link"
              onClick={() => showAppRunConfig(record)}>
              {t('label.config')}
            </Button>
            {/* For status running or activewitherror and supportsInterrupt is true, show stop button */}
            {(record.status === Status.Running ||
              record.status === Status.ActiveError) &&
              Boolean(appData?.supportsInterrupt) && (
                <Button
                  className="m-l-xs p-0"
                  data-testid="stop-button"
                  size="small"
                  type="link"
                  onClick={() => setIsStopModalOpen(true)}>
                  {t('label.stop')}
                </Button>
              )}
          </>
        );
      },
      [showLogAction, appData, isExternalApp, handleRowExpandable]
    );

    const tableColumn: ColumnsType<AppRunRecordWithId> = useMemo(
      () => [
        {
          title: t('label.run-at'),
          dataIndex: 'timestamp',
          key: 'timestamp',
          render: (_, record) => {
            return isExternalApp
              ? formatDateTime(record.startTime)
              : formatDateTime(record.timestamp);
          },
        },
        {
          title: t('label.run-type'),
          dataIndex: 'runType',
          key: 'runType',
          render: (runType) => (
            <Typography.Text>{runType ?? NO_DATA_PLACEHOLDER}</Typography.Text>
          ),
        },
        {
          title: t('label.duration'),
          dataIndex: 'executionTime',
          key: 'executionTime',
          render: (_, record: AppRunRecordWithId) => {
            if (isExternalApp && record.executionTime) {
              return formatDurationToHHMMSS(record.executionTime);
            }

            if (record.startTime) {
              const endTime = record.endTime || Date.now(); // Use current time in epoch milliseconds if endTime is not present
              const ms = getIntervalInMilliseconds(record.startTime, endTime);

              return formatDurationToHHMMSS(ms);
            } else {
              return NO_DATA_PLACEHOLDER;
            }
          },
        },
        {
          title: t('label.status'),
          dataIndex: 'status',
          key: 'status',
          render: (_, record: AppRunRecordWithId) => {
            const status: StatusType = getStatusTypeForApplication(
              record.status ?? Status.Stopped
            );

            return record.status ? (
              <StatusBadge
                dataTestId="pipeline-status"
                label={STATUS_LABEL[record.status as keyof typeof STATUS_LABEL]}
                status={status}
              />
            ) : (
              NO_DATA_PLACEHOLDER
            );
          },
        },
        {
          title: t('label.action-plural'),
          dataIndex: 'actions',
          key: 'actions',
          render: (_, record) => getActionButton(record),
        },
      ],
      [
        appData,
        formatDateTime,
        handleRowExpandable,
        getStatusTypeForApplication,
        showLogAction,
        getActionButton,
      ]
    );

    const fetchAppHistory = useCallback(
      async (pagingOffset?: Paging) => {
        try {
          setIsLoading(true);

          if (isExternalApp) {
            const currentTime = Date.now();
            // past 30 days
            const startDay = getEpochMillisForPastDays(30);

            const { data } = await getApplicationRuns(fqn, {
              startTs: startDay,
              endTs: currentTime,
              limit: maxRecords ?? pageSize,
            });

            setAppRunsHistoryData(
              data
                .map((item) => ({
                  ...item,
                  id: `${item.appId}-${item.runType}-${item.timestamp}`,
                }))
                .slice(0, maxRecords)
            );
          } else {
            const { data, paging } = await getApplicationRuns(fqn, {
              offset: pagingOffset?.offset ?? 0,
              limit: maxRecords ?? pageSize,
            });

            setAppRunsHistoryData(
              data.map((item) => ({
                ...item,
                id: `${item.appId}-${item.runType}-${item.timestamp}`,
              }))
            );
            handlePagingChange(paging);
          }
        } catch (err) {
          showErrorToast(err as AxiosError);
        } finally {
          setIsLoading(false);
        }
      },
      [fqn, pageSize, maxRecords, appData]
    );

    const handleAppHistoryPageChange = ({
      currentPage,
    }: PagingHandlerParams) => {
      handlePageChange(currentPage);
      fetchAppHistory({
        offset: (currentPage - 1) * pageSize,
      } as Paging);
    };

    const handleAppHistoryRecordUpdate = (
      updatedRecord: AppRunRecordWithId
    ) => {
      setAppRunsHistoryData((prev) => {
        const updatedData = prev.map((item) => {
          if (
            item.appId === updatedRecord.appId &&
            item.startTime === updatedRecord.startTime
          ) {
            return { ...updatedRecord, id: item.id };
          }

          return item;
        });

        return updatedData;
      });
    };

    useImperativeHandle(ref, () => ({
      refreshAppHistory() {
        fetchAppHistory();
      },
    }));

    useEffect(() => {
      fetchAppHistory();
    }, [fqn, pageSize]);

    useEffect(() => {
      if (socket) {
        socket.on(SOCKET_EVENTS.SEARCH_INDEX_JOB_BROADCAST_CHANNEL, (data) => {
          if (data) {
            const searchIndexJob = JSON.parse(data);
            handleAppHistoryRecordUpdate(searchIndexJob);
          }
        });

        socket.on(SOCKET_EVENTS.DATA_INSIGHTS_JOB_BROADCAST_CHANNEL, (data) => {
          if (data) {
            const dataInsightJob = JSON.parse(data);
            handleAppHistoryRecordUpdate(dataInsightJob);
          }
        });
      }

      return () => {
        if (socket) {
          socket.off(SOCKET_EVENTS.SEARCH_INDEX_JOB_BROADCAST_CHANNEL);
          socket.off(SOCKET_EVENTS.DATA_INSIGHTS_JOB_BROADCAST_CHANNEL);
        }
      };
    }, [socket]);

    return (
      <>
        <Table
          columns={tableColumn}
          customPaginationProps={{
            isNumberBased: true,
            showPagination: showPagination && paginationVisible,
            currentPage,
            isLoading,
            pageSize,
            paging,
            pagingHandler: handleAppHistoryPageChange,
            onShowSizeChange: handlePageSizeChange,
          }}
          data-testid="app-run-history-table"
          dataSource={appRunsHistoryData}
          expandable={{
            expandedRowRender: (record) => (
              <AppLogsViewer
                data={record}
                scrollHeight={maxRecords !== 1 ? 200 : undefined}
              />
            ),
            showExpandColumn: false,
            rowExpandable: (record) => !showLogAction(record),
            expandedRowKeys,
          }}
          loading={isLoading}
          locale={{
            emptyText: <ErrorPlaceHolder className="m-y-md" />,
          }}
          pagination={false}
          rowKey="id"
          size="small"
        />

        {isStopModalOpen && (
          <StopScheduleModal
            appName={fqn}
            displayName={appData?.displayName ?? ''}
            isModalOpen={isStopModalOpen}
            onClose={() => {
              setIsStopModalOpen(false);
            }}
            onStopWorkflowsUpdate={() => {
              fetchAppHistory();
            }}
          />
        )}
        <Modal
          centered
          destroyOnClose
          bodyStyle={{
            maxHeight: 700,
            overflowY: 'scroll',
          }}
          className="app-config-modal"
          closable={false}
          data-testid="edit-table-type-property-modal"
          footer={
            <Space className="w-full justify-end">
              <Button
                data-testid="app-run-config-close"
                type="primary"
                onClick={() => setShowConfigModal(false)}>
                {t('label.close')}
              </Button>
            </Space>
          }
          maskClosable={false}
          open={showConfigModal}
          title={
            <Typography.Text>
              {t('label.entity-configuration', {
                entity: getEntityName(appData) ?? t('label.application'),
              })}
            </Typography.Text>
          }
          width={800}>
          <FormBuilder
            hideCancelButton
            readonly
            useSelectWidget
            cancelText={t('label.back')}
            formData={appRunRecordConfig}
            isLoading={false}
            okText={t('label.submit')}
            schema={jsonSchema}
            serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
            uiSchema={UiSchema}
            validator={validator}
            onCancel={noop}
            onSubmit={noop}
          />
        </Modal>
      </>
    );
  }
);

export default AppRunsHistory;
