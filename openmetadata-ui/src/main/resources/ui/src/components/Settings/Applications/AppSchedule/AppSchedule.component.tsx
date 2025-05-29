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
import { Button, Col, Modal, Row, Space, Typography } from 'antd';
import cronstrue from 'cronstrue';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import {
  AppScheduleClass,
  AppType,
  ScheduleType,
} from '../../../../generated/entity/applications/app';
import { getIngestionPipelineByFqn } from '../../../../rest/ingestionPipelineAPI';
import { getCronDefaultValue } from '../../../../utils/SchedularUtils';
import Loader from '../../../common/Loader/Loader';
import ScheduleInterval from '../../Services/AddIngestion/Steps/ScheduleInterval';
import { WorkflowExtraConfig } from '../../Services/AddIngestion/Steps/ScheduleInterval.interface';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import { AppRunsHistoryRef } from '../AppRunsHistory/AppRunsHistory.interface';
import { AppScheduleProps } from './AppScheduleProps.interface';

const AppSchedule = ({
  appData,
  loading: { isRunLoading, isDeployLoading },
  jsonSchema,
  onSave,
  onDemandTrigger,
  onDeployTrigger,
}: AppScheduleProps) => {
  const { t } = useTranslation();
  const [showModal, setShowModal] = useState(false);
  const appRunsHistoryRef = useRef<AppRunsHistoryRef>(null);
  const [isPipelineDeployed, setIsPipelineDeployed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaveLoading, setIsSaveLoading] = useState(false);
  const { config } = useLimitStore();

  const showRunNowButton = useMemo(() => {
    return [ScheduleType.ScheduledOrManual, ScheduleType.OnlyManual].includes(
      appData?.scheduleType
    );
  }, [appData]);

  const { pipelineSchedules } =
    config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'app'
    ) ?? {};

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

  const cronString = useMemo(() => {
    const cronExpression = (appData.appSchedule as AppScheduleClass)
      ?.cronExpression;
    if (cronExpression) {
      return cronstrue.toString(cronExpression, {
        throwExceptionOnParseError: false,
      });
    }

    return '';
  }, [appData]);

  const onDialogCancel = () => {
    setShowModal(false);
  };

  const onDialogSave = async (data: WorkflowExtraConfig) => {
    setIsSaveLoading(true);
    await onSave(data.cron ?? '');
    setIsSaveLoading(false);
    setShowModal(false);
  };

  const onAppTrigger = async () => {
    await onDemandTrigger();

    // Refresh the app history after 750ms to get the latest run as the run is triggered asynchronously
    setTimeout(() => {
      appRunsHistoryRef.current?.refreshAppHistory();
    }, 750);
  };

  const appRunHistory = useMemo(() => {
    if (
      !appData.deleted &&
      (appData.appType === AppType.Internal || isPipelineDeployed)
    ) {
      return (
        <AppRunsHistory
          appData={appData}
          jsonSchema={jsonSchema}
          maxRecords={1}
          ref={appRunsHistoryRef}
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
  }, [appData, isPipelineDeployed, appRunsHistoryRef]);

  const { initialOptions, initialData, defaultCron } = useMemo(() => {
    return {
      initialOptions: applicationsClassBase.getScheduleOptionsForApp(
        appData.name,
        appData.appType,
        pipelineSchedules
      ),
      initialData: {
        cron: (appData.appSchedule as AppScheduleClass)?.cronExpression,
      },
      defaultCron: getCronDefaultValue(appData?.name ?? ''),
    };
  }, [appData.name, appData.appType, appData.appSchedule, pipelineSchedules]);

  useEffect(() => {
    fetchPipelineDetails();
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
              <div className="d-flex items-center gap-2">
                <Typography.Text className="right-panel-label">
                  {t('label.schedule-type')}
                </Typography.Text>
                <Typography.Text
                  className="font-medium"
                  data-testid="schedule-type">
                  {(appData.appSchedule as AppScheduleClass).scheduleTimeline ??
                    ''}
                </Typography.Text>
              </div>

              {!isEmpty(cronString) && (
                <div className="d-flex items-center gap-2">
                  <Typography.Text className="right-panel-label">
                    {t('label.schedule-interval')}
                  </Typography.Text>
                  <Typography.Text
                    className="font-medium"
                    data-testid="cron-string">
                    {cronString}
                  </Typography.Text>
                </div>
              )}
            </>
          )}
        </Col>
        {!appData.deleted && (
          <Col className="d-flex items-center justify-end" flex="200px">
            <Space>
              {appData.appType === AppType.External && (
                <Button
                  data-testid="deploy-button"
                  disabled={appData.deleted}
                  loading={isDeployLoading}
                  type="primary"
                  onClick={onDeployTrigger}>
                  {t('label.deploy')}
                </Button>
              )}

              {!appData.system && (
                <Button
                  data-testid="edit-button"
                  disabled={appData.deleted}
                  type="primary"
                  onClick={() => setShowModal(true)}>
                  {t('label.edit')}
                </Button>
              )}

              {showRunNowButton && (
                <Button
                  data-testid="run-now-button"
                  disabled={appData.deleted}
                  loading={isRunLoading}
                  type="primary"
                  onClick={onAppTrigger}>
                  {t('label.run-now')}
                </Button>
              )}
            </Space>
          </Col>
        )}

        <Col className="mt-4" span={24}>
          {appRunHistory}
        </Col>
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
        title={t('label.update-entity', { entity: t('label.schedule') })}
        width={650}>
        <ScheduleInterval
          isEditMode
          buttonProps={{
            cancelText: t('label.cancel'),
            okText: t('label.save'),
          }}
          defaultSchedule={defaultCron}
          includePeriodOptions={initialOptions}
          initialData={initialData}
          status={isSaveLoading ? 'waiting' : 'initial'}
          onBack={onDialogCancel}
          onDeploy={onDialogSave}
        />
      </Modal>
    </>
  );
};

export default AppSchedule;
