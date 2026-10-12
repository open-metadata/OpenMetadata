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

import {
  Box,
  Button,
  Dialog,
  Modal,
  ModalOverlay,
  Typography,
} from '@openmetadata/ui-core-components';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import {
  App,
  AppScheduleClass,
  AppType,
  ScheduleType,
} from '../../../../generated/entity/applications/app';
import { getIngestionPipelineByFqn } from '../../../../rest/ingestionPipelineAPI';
import { getCronDefaultValue } from '../../../../utils/CronExpressionUtils';
import Loader from '../../../common/Loader/Loader';
import ScheduleInterval from '../../Services/AddIngestion/Steps/ScheduleInterval';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';
import AppRunsHistory from '../AppRunsHistory/AppRunsHistory.component';
import { AppRunsHistoryRef } from '../AppRunsHistory/AppRunsHistory.interface';
import { AppScheduleProps } from './AppScheduleProps.interface';

// The schedule read-out is self-contained; keeping it out of AppSchedule keeps
// that component's branching down to the action buttons it actually owns.
const AppScheduleSummary = ({
  appSchedule,
  cronString,
}: {
  appSchedule?: App['appSchedule'];
  cronString: string;
}) => {
  const { t } = useTranslation();

  if (!appSchedule) {
    return null;
  }

  return (
    <>
      <Box align="center" direction="row" gap={2}>
        <Typography className="right-panel-label">
          {t('label.schedule-type')}
        </Typography>
        <Typography className="font-medium" data-testid="schedule-type">
          {(appSchedule as AppScheduleClass).scheduleTimeline ?? ''}
        </Typography>
      </Box>

      {!isEmpty(cronString) && (
        <Box align="center" direction="row" gap={2}>
          <Typography className="right-panel-label">
            {t('label.schedule-interval')}
          </Typography>
          <Typography className="font-medium" data-testid="cron-string">
            {cronString}
          </Typography>
        </Box>
      )}
    </>
  );
};

// The action buttons gate on their own flags; kept apart so AppSchedule's
// branching stays about what it renders, not about each button.
const AppScheduleActions = ({
  showDeploy,
  showEdit,
  showRunNow,
  isDeployLoading,
  isRunLoading,
  onDeploy,
  onEdit,
  onRunNow,
}: {
  showDeploy: boolean;
  showEdit: boolean;
  showRunNow: boolean;
  isDeployLoading: boolean;
  isRunLoading: boolean;
  onDeploy: () => void;
  onEdit: () => void;
  onRunNow: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Box align="center" direction="row" gap={2}>
      {showDeploy && (
        <Button
          color="secondary"
          data-testid="deploy-button"
          isLoading={isDeployLoading}
          size="sm"
          onPress={onDeploy}>
          {t('label.deploy')}
        </Button>
      )}
      {showEdit && (
        <Button
          color="secondary"
          data-testid="edit-button"
          size="sm"
          onPress={onEdit}>
          {t('label.edit')}
        </Button>
      )}
      {showRunNow && (
        <Button
          color="primary"
          data-testid="run-now-button"
          isLoading={isRunLoading}
          size="sm"
          onPress={onRunNow}>
          {t('label.run-now')}
        </Button>
      )}
    </Box>
  );
};

const AppSchedule = ({
  appData,
  loading: { isRunLoading, isDeployLoading },
  jsonSchema,
  disabled = false,
  disabledReason,
  canEdit = true,
  canTrigger = true,
  canDeploy = true,
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
  const [scheduleValue, setScheduleValue] = useState<string>();
  const [isScheduleValid, setIsScheduleValid] = useState(true);
  const { config } = useLimitStore();
  const isAppDisabled = disabled || Boolean(appData.deleted);

  const showRunNowButton = useMemo(() => {
    return [ScheduleType.ScheduledOrManual, ScheduleType.OnlyManual].includes(
      appData?.scheduleType
    );
  }, [appData]);

  const { pipelineSchedules } =
    config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'app'
    ) ?? {};

  // Keyed on the two fields it reads, not the whole app: a schedule save
  // replaces appData, and refetching then would flash the loader over the
  // open schedule dialog and remount the runs history. Deploy still re-checks,
  // because it reloads the app and remounts this tab.
  const { appType } = appData;
  const firstPipeline = appData.pipelines?.[0];
  const pipelineFqn = firstPipeline
    ? firstPipeline.fullyQualifiedName ?? ''
    : undefined;

  const fetchPipelineDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      if (appType === AppType.External && pipelineFqn !== undefined) {
        const pipelineData = await getIngestionPipelineByFqn(pipelineFqn);

        setIsPipelineDeployed(pipelineData.deployed ?? false);
      } else {
        setIsPipelineDeployed(false);
      }
    } catch (error) {
      setIsPipelineDeployed(false);
    } finally {
      setIsLoading(false);
    }
  }, [appType, pipelineFqn]);

  const [cronString, setCronString] = useState<string>('');

  useEffect(() => {
    const cronExpression = (appData.appSchedule as AppScheduleClass)
      ?.cronExpression;
    if (!cronExpression) {
      setCronString('');

      return;
    }
    let cancelled = false;
    import('cronstrue').then((m) => {
      if (!cancelled) {
        setCronString(
          m.default.toString(cronExpression, {
            throwExceptionOnParseError: false,
          })
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [appData]);

  const onDialogCancel = () => {
    setShowModal(false);
  };

  const onDialogOpen = () => {
    setScheduleValue(
      (appData.appSchedule as AppScheduleClass)?.cronExpression ?? undefined
    );
    setIsScheduleValid(true);
    setShowModal(true);
  };

  const onDialogSave = async () => {
    setIsSaveLoading(true);
    await onSave(scheduleValue ?? '');
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
      !isAppDisabled &&
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

    if (isAppDisabled) {
      return (
        <Typography>
          {disabledReason ?? t('message.application-disabled-message')}
        </Typography>
      );
    }

    return <Typography>{t('message.no-ingestion-pipeline-found')}</Typography>;
  }, [
    appData,
    disabledReason,
    isAppDisabled,
    isPipelineDeployed,
    appRunsHistoryRef,
    jsonSchema,
    t,
  ]);

  const { initialOptions, defaultCron } = useMemo(() => {
    return {
      initialOptions: applicationsClassBase.getScheduleOptionsForApp(
        appData.name,
        appData.appType,
        pipelineSchedules
      ),
      defaultCron: getCronDefaultValue(appData?.name ?? ''),
    };
  }, [appData.name, appData.appType, pipelineSchedules]);

  useEffect(() => {
    fetchPipelineDetails();
  }, [fetchPipelineDetails]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <>
      <Box className="layout-row" wrap="wrap">
        <Box
          className="layout-column tw:block flex-col"
          style={{ flex: 'auto' }}>
          <AppScheduleSummary
            appSchedule={appData.appSchedule}
            cronString={cronString}
          />
        </Box>
        {!isAppDisabled && (
          <Box
            className="layout-column d-flex items-center justify-end"
            style={{ flex: '0 0 200px' }}>
            <AppScheduleActions
              isDeployLoading={isDeployLoading}
              isRunLoading={isRunLoading}
              showDeploy={canDeploy && appData.appType === AppType.External}
              showEdit={canEdit && !appData.system}
              showRunNow={canTrigger && showRunNowButton}
              onDeploy={onDeployTrigger}
              onEdit={onDialogOpen}
              onRunNow={onAppTrigger}
            />
          </Box>
        )}

        <Box
          className="layout-column tw:block mt-4"
          style={{ maxWidth: '100%', flex: '0 0 100%' }}>
          {appRunHistory}
        </Box>
      </Box>
      <ModalOverlay isDismissable={false} isOpen={showModal}>
        <Modal>
          <Dialog
            data-testid="update-schedule-modal"
            dividers="scroll"
            title={t('label.update-entity', { entity: t('label.schedule') })}
            width={650}
            onClose={onDialogCancel}>
            <Dialog.Content>
              <ScheduleInterval
                defaultSchedule={defaultCron}
                includePeriodOptions={initialOptions}
                value={scheduleValue}
                onChange={setScheduleValue}
                onValidityChange={setIsScheduleValid}
              />
            </Dialog.Content>
            <Dialog.Footer>
              <Box
                className="tw:col-span-2"
                direction="row"
                gap={3}
                justify="end">
                <Button
                  color="tertiary"
                  data-testid="back-button"
                  size="sm"
                  onPress={onDialogCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="deploy-button"
                  isDisabled={!isScheduleValid}
                  isLoading={isSaveLoading}
                  size="sm"
                  onPress={onDialogSave}>
                  {t('label.save')}
                </Button>
              </Box>
            </Dialog.Footer>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
};

export default AppSchedule;
