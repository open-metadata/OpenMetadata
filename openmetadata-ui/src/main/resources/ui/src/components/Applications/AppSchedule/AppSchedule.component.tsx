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
import { Button, Col, Divider, Modal, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import cronstrue from 'cronstrue';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  AppScheduleClass,
  AppType,
} from '../../../generated/entity/applications/app';
import { Status } from '../../../generated/entity/applications/appRunRecord';
import {
  PipelineState,
  PipelineStatus,
  PipelineType,
} from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Paging } from '../../../generated/type/paging';
import { getApplicationRuns } from '../../../rest/applicationAPI';
import { getIngestionPipelineByFqn } from '../../../rest/ingestionPipelineAPI';
import { getStatusFromPipelineState } from '../../../utils/ApplicationUtils';
import { getIngestionFrequency } from '../../../utils/CommonUtils';
import { getEpochMillisForPastDays } from '../../../utils/date-time/DateTimeUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import TestSuiteScheduler from '../../AddDataQualityTest/components/TestSuiteScheduler';
import Loader from '../../Loader/Loader';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import {
  AppRunRecordWithId,
  AppRunsHistoryRef,
} from '../AppRunsHistory/AppRunsHistory.interface';
import { AppScheduleProps } from './AppScheduleProps.interface';

const AppSchedule = ({
  appData,
  onSave,
  onDemandTrigger,
  onDeployTrigger,
}: AppScheduleProps) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const appRunsHistoryRef = useRef<AppRunsHistoryRef>(null);
  const [isPipelineDeployed, setIsPipelineDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [appRunsHistoryData, setAppRunsHistoryData] = useState<
    AppRunRecordWithId[]
  >([]);

  const isExternalApp = useMemo(
    () => appData?.appType === AppType.External,
    [appData]
  );

  const isAppRunning = useMemo(() => {
    if (appRunsHistoryData.length > 0) {
      return appRunsHistoryData[0].status === Status.Running;
    } else {
      return false;
    }
  }, [appRunsHistoryData]);

  const fetchPipelineDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      if (
        appData.appType === AppType.External &&
        appData.pipelines &&
        appData.pipelines.length > 0
      ) {
        const fqn = appData.pipelines[0].fullyQualifiedName ?? '';
        const pipelineData = await getIngestionPipelineByFqn(fqn);

        setIsPipelineDeployed(pipelineData.deployed ?? false);
      } else {
        setIsPipelineDeployed(false);
      }
    } catch (error) {
      setIsPipelineDeployed(false);
    } finally {
      setIsLoading(false);
    }
  }, [appData]);

  const fetchAppHistory = useCallback(
    async (pagingOffset?: Paging) => {
      try {
        setIsLoading(true);

        if (isExternalApp) {
          const currentTime = Date.now();
          // past 30 days
          const startDay = getEpochMillisForPastDays(30);

          const { data } = await getApplicationRuns(
            appData.fullyQualifiedName ?? '',
            {
              startTs: startDay,
              endTs: currentTime,
            }
          );

          setAppRunsHistoryData(
            data
              .map((item) => ({
                ...item,
                status: getStatusFromPipelineState(
                  (item as PipelineStatus).pipelineState ?? PipelineState.Failed
                ),
                id: (item as PipelineStatus).runId ?? '',
              }))
              .slice(0, 1)
          );
        } else {
          const { data } = await getApplicationRuns(
            appData.fullyQualifiedName ?? '',
            {
              offset: pagingOffset?.offset ?? 0,
              limit: 1,
            }
          );

          setAppRunsHistoryData(
            data.map((item) => ({
              ...item,
              id: `${item.appId}-${item.runType}-${item.timestamp}`,
            }))
          );
        }
      } catch (err) {
        showErrorToast(err as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [appData]
  );

  const cronString = useMemo(() => {
    if (appData.appSchedule) {
      const cronExp =
        (appData.appSchedule as AppScheduleClass).cronExpression ?? '';

      return cronstrue.toString(cronExp, {
        throwExceptionOnParseError: false,
        dayOfWeekStartIndexZero: false,
        monthStartIndexZero: false,
      });
    }

    return '';
  }, [appData]);

  const onDialogCancel = () => {
    setShowModal(false);
  };

  const onDialogSave = (cron: string) => {
    onSave(cron);
    setShowModal(false);
  };

  const onAppTrigger = async () => {
    await onDemandTrigger();
    await fetchAppHistory();
  };

  const appRunHistory = useMemo(() => {
    if (
      !appData.deleted &&
      (appData.appType === AppType.Internal || isPipelineDeployed)
    ) {
      return (
        <AppRunsHistory
          appData={appData}
          maxRecords={1}
          ref={appRunsHistoryRef}
          runsData={appRunsHistoryData}
          showPagination={false}
        />
      );
    }

    if (appData.deleted) {
      return (
        <Typography.Text>
          {t('message.application-disabled-message')}
        </Typography.Text>
      );
    }

    return (
      <Typography.Text>
        {t('message.no-ingestion-pipeline-found')}
      </Typography.Text>
    );
  }, [appData, isPipelineDeployed, appRunsHistoryRef, appRunsHistoryData]);

  useEffect(() => {
    fetchPipelineDetails();
    fetchAppHistory();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <Row>
        <Col className="flex-col" flex="auto">
          {appData.appSchedule && (
            <>
              <div>
                <Space size={8}>
                  <Typography.Text className="right-panel-label">
                    {t('label.schedule-type')}
                  </Typography.Text>
                  <Typography.Text className="font-medium">
                    {(appData.appSchedule as AppScheduleClass).scheduleType ??
                      ''}
                  </Typography.Text>
                </Space>
              </div>
              <div>
                <Space size={8}>
                  <Typography.Text className="right-panel-label">
                    {t('label.schedule-interval')}
                  </Typography.Text>
                  <Typography.Text
                    className="font-medium"
                    data-testid="cron-string">
                    {cronString}
                  </Typography.Text>
                </Space>
              </div>
            </>
          )}
        </Col>
        {!appData.deleted && (
          <Col className="d-flex items-center justify-end" flex="200px">
            <Space>
              {appData.appType === AppType.External && (
                <Button
                  data-testid="deploy-button"
                  type="primary"
                  onClick={onDeployTrigger}>
                  {t('label.deploy')}
                </Button>
              )}

              <Button
                data-testid="edit-button"
                type="primary"
                onClick={() => setShowModal(true)}>
                {t('label.edit')}
              </Button>

              <Button
                data-testid="run-now-button"
                disabled={isAppRunning}
                type="primary"
                onClick={onAppTrigger}>
                {t('label.run-now')}
              </Button>
            </Space>
          </Col>
        )}

        <Divider />

        <Col span={24}>{appRunHistory}</Col>
      </Row>
      <Modal
        destroyOnClose
        className="update-schedule-modal"
        closable={false}
        data-testid="update-schedule-modal"
        footer={null}
        maskClosable={false}
        okText={t('label.save')}
        open={showModal}
        title={t('label.update-entity', { entity: t('label.schedule') })}>
        <TestSuiteScheduler
          isQuartzCron
          buttonProps={{
            cancelText: t('label.cancel'),
            okText: t('label.save'),
          }}
          includePeriodOptions={
            appData.appType === AppType.External ? ['Day'] : undefined
          }
          initialData={getIngestionFrequency(PipelineType.Application)}
          onCancel={onDialogCancel}
          onSubmit={onDialogSave}
        />
      </Modal>
    </>
  );
};

export default AppSchedule;
