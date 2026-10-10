/*
 *  Copyright 2026 Collate.
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
  Card,
  EmptyPlaceholder,
  ProgressSteps,
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  CheckCircle,
  Clock,
  GridView,
  User01,
} from '@openmetadata/ui-core-components/icons';
import { RJSFSchema } from '@rjsf/utils';
import { AxiosError } from 'axios';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLimitStore } from '../../../../../../context/LimitsProvider/useLimitsStore';
import { TabSpecificField } from '../../../../../../enums/entity.enum';
import { AppMarketPlaceDefinition } from '../../../../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { EntityReference } from '../../../../../../generated/entity/type';
import { useApplicationStore } from '../../../../../../hooks/useApplicationStore';
import { installApplication } from '../../../../../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../../../../../rest/applicationMarketPlaceAPI';
import {
  getCronDefaultValue,
  getDefaultScheduleValue,
} from '../../../../../../utils/CronExpressionUtils';
import { getRelativeTime } from '../../../../../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../../utils/ToastUtils';
import BrandImage from '../../../../../common/BrandImage/BrandImage';
import UserPopOverCard from '../../../../../common/PopOverCard/UserPopOverCard';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import ScheduleInterval from '../../../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
import { HintToggle } from './AppConfigForm';
import { AppFooter } from './AppFooter';
import type { ApplicationsViewProps, InstallStep } from './Applications.types';
import { buildCreateAppRequest, getInstallSteps } from './Applications.utils';

interface AppInstallProps extends ApplicationsViewProps {
  fqn: string;
}

const STEP_LABEL: Record<InstallStep, string> = {
  details: 'label.detail-plural',
  configure: 'label.configure',
  schedule: 'label.schedule',
};

const StepFooter: FC<{
  backLabel: string;
  nextLabel: string;
  isLoading?: boolean;
  isNextDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
}> = ({ backLabel, nextLabel, isLoading, isNextDisabled, onBack, onNext }) => (
  <AppFooter testId="app-install-footer">
    <Button
      color="tertiary"
      data-testid="back-button"
      isDisabled={isLoading}
      onPress={onBack}>
      {backLabel}
    </Button>
    <Button
      color="primary"
      data-testid="next-button"
      isDisabled={isNextDisabled}
      isLoading={isLoading}
      onPress={onNext}>
      {nextLabel}
    </Button>
  </AppFooter>
);

const AppInstallDetailsStep: FC<{
  appData: AppMarketPlaceDefinition;
  footer: ReactNode;
}> = ({ appData, footer }) => {
  const { t } = useTranslation();
  const { currentUser } = useApplicationStore();
  const Icon = applicationsClassBase.getAppIcon(appData.name);

  return (
    <Box className="tw:mx-auto tw:w-full tw:max-w-140" direction="col">
      <Box align="center" direction="col" gap={4}>
        <Box align="center" direction="row" gap={4}>
          <Box
            align="center"
            className="tw:size-16 tw:rounded-xl tw:bg-secondary"
            justify="center">
            <Icon className="tw:size-8 tw:text-fg-secondary" />
          </Box>
          <Box
            align="center"
            className="tw:w-24 tw:border-t tw:border-dashed tw:border-secondary"
            justify="center">
            <CheckCircle className="tw:-mt-2.5 tw:size-5 tw:bg-primary tw:text-fg-success-primary" />
          </Box>
          <Box
            align="center"
            className="tw:size-16 tw:rounded-xl tw:border tw:border-secondary tw:bg-primary"
            justify="center">
            <BrandImage
              isMonoGram
              dataTestId="brand-monogram"
              height={36}
              width={36}
            />
          </Box>
        </Box>
        <Typography as="h5" size="text-md" weight="semibold">
          {t('label.authorize-app', { app: getEntityName(appData) })}
        </Typography>
      </Box>

      <Card className="tw:mt-4" data-testid="authorize-card" size="md">
        <Card.Content>
          <Box align="center" direction="row" gap={3}>
            <UserPopOverCard
              profileWidth={32}
              userName={currentUser?.name ?? ''}
            />
            <Box direction="col">
              <Typography size="text-sm" weight="medium">
                <Transi18next
                  i18nKey="label.application-by-developer"
                  renderElement={
                    <Button
                      noTextPadding
                      aria-label={appData.developer}
                      color="link-color"
                      href={appData.developerUrl}
                      rel="noreferrer"
                      size="sm"
                      target="_blank"
                    />
                  }
                  values={{
                    dev: appData.developer,
                    app: getEntityName(appData),
                  }}
                />
              </Typography>
              <Typography className="tw:text-tertiary" size="text-xs">
                {t('label.wants-to-access-your-account', {
                  username: currentUser?.displayName ?? currentUser?.name,
                })}
              </Typography>
            </Box>
          </Box>
          <Typography
            className="tw:mt-4 tw:block tw:border-t tw:border-secondary tw:pt-4 tw:text-secondary"
            size="text-sm">
            {t('label.all-entity', { entity: t('label.metadata') })}
          </Typography>
        </Card.Content>
      </Card>

      <Box
        className="tw:mt-3 tw:text-tertiary"
        direction="row"
        justify="between">
        <Box align="center" direction="row" gap={2}>
          <User01 className="tw:size-4" />
          <Typography size="text-xs">
            {t('label.developed-by-developer', {
              developer: appData.developer,
            })}
          </Typography>
        </Box>
        <Box align="center" direction="row" gap={2}>
          <Clock className="tw:size-4" />
          <Typography size="text-xs">
            {`${t('label.updated')} ${getRelativeTime(appData.updatedAt)}`}
          </Typography>
        </Box>
      </Box>

      {footer}
    </Box>
  );
};

const AppInstall: FC<AppInstallProps> = ({
  fqn,
  onNavigate,
  onHeaderChange,
}) => {
  const { t } = useTranslation();
  const { config, getResourceLimit } = useLimitStore();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [appConfiguration, setAppConfiguration] =
    useState<Record<string, unknown>>();
  const [ingestionRunner, setIngestionRunner] = useState<EntityReference>();
  const [scheduleValue, setScheduleValue] = useState<string>();
  const [isScheduleValid, setIsScheduleValid] = useState(true);
  // `undefined` is a valid on-demand selection, so initialization needs its own flag.
  const isScheduleInitialized = useRef(false);

  const steps = useMemo(
    // Without a schema there is no form to show, so the Configure step is
    // skipped rather than leaving the wizard on an empty step.
    () =>
      appData
        ? getInstallSteps({
            ...appData,
            allowConfiguration:
              appData.allowConfiguration && Boolean(jsonSchema),
          })
        : [],
    [appData, jsonSchema]
  );
  const currentStep = steps[stepIndex];

  const { pipelineSchedules } =
    config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'app'
    ) ?? {};

  const { initialOptions, defaultCron } = useMemo(
    () => ({
      initialOptions: appData
        ? applicationsClassBase.getScheduleOptionsForApp(
            appData.name,
            appData.appType,
            pipelineSchedules
          )
        : undefined,
      defaultCron: getCronDefaultValue(appData?.name ?? ''),
    }),
    [appData, pipelineSchedules]
  );

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    // Fetched independently so each failure shows its own error.
    const [marketplaceApp, schema] = await Promise.allSettled([
      getMarketPlaceApplicationByFqn(fqn, { fields: TabSpecificField.OWNERS }),
      applicationsClassBase.importSchema(fqn),
    ]);
    if (marketplaceApp.status === 'fulfilled') {
      setAppData(marketplaceApp.value);
    } else {
      showErrorToast(marketplaceApp.reason as AxiosError);
    }
    if (schema.status === 'fulfilled') {
      setJsonSchema(schema.value);
    } else if (marketplaceApp.status === 'fulfilled') {
      showErrorToast(t('server.no-application-schema-found', { appName: fqn }));
    }
    setIsLoading(false);
  }, [fqn, t]);

  useEffect(() => {
    void fetchAppDetails();
  }, [fetchAppDetails]);

  useEffect(() => {
    if (!appData) {
      // Not found: keep the trail pointing at the requested app.
      if (!isLoading) {
        onHeaderChange({ crumb: fqn });
      }

      return;
    }

    onHeaderChange({
      title: t('label.install-entity', { entity: getEntityName(appData) }),
      description: t('label.developed-by-developer', {
        developer: appData.developer,
      }),
      icon: applicationsClassBase.getAppIcon(appData.name),
      crumb: getEntityName(appData),
      actions:
        currentStep === 'configure' ? (
          <HintToggle isSelected={showHint} onChange={setShowHint} />
        ) : undefined,
    });
  }, [appData, currentStep, fqn, isLoading, onHeaderChange, showHint, t]);

  const goToStep = (step: InstallStep) => {
    if (step === 'schedule' && !isScheduleInitialized.current) {
      setScheduleValue(
        getDefaultScheduleValue({
          defaultSchedule: defaultCron,
          includePeriodOptions: initialOptions,
          allowNoSchedule: true,
        })
      );
      isScheduleInitialized.current = true;
    }
    setStepIndex(steps.indexOf(step));
  };

  const goNext = () => goToStep(steps[stepIndex + 1]);

  const goBack = () =>
    stepIndex === 0
      ? onNavigate({ type: 'marketplace-detail', fqn })
      : setStepIndex(stepIndex - 1);

  const install = async (
    configuration?: Record<string, unknown>,
    runner?: EntityReference
  ) => {
    if (!appData) {
      return;
    }
    const request = buildCreateAppRequest({
      app: appData,
      configuration,
      cron: steps.includes('schedule') ? scheduleValue ?? '' : undefined,
      ingestionRunner: runner,
    });

    setIsSaving(true);
    try {
      await installApplication(request);
      showSuccessToast(t('message.app-installed-successfully'));
      // Update current count when Create / Delete operation performed
      await getResourceLimit('app', true, true);
      onNavigate({ type: 'list' });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  const isLastStep = stepIndex === steps.length - 1;

  const handleConfigSave = ({
    formData,
    ingestionRunner: runner,
  }: {
    formData: Record<string, unknown>;
    ingestionRunner?: EntityReference;
  }) => {
    setAppConfiguration(formData);
    setIngestionRunner(runner);
    if (isLastStep) {
      void install(formData, runner);
    } else {
      goNext();
    }
  };

  if (isLoading) {
    return (
      <Box className="tw:px-8 tw:pb-8" direction="col" gap={4}>
        <Skeleton height={60} variant="rounded" width="100%" />
        <Skeleton height={240} variant="rounded" width="100%" />
      </Box>
    );
  }

  if (!appData) {
    return (
      <Box className="tw:relative tw:min-h-90 tw:mx-8">
        <EmptyPlaceholder
          data-testid="app-not-found"
          description={fqn}
          icon={GridView}
          title={t('label.no-entity', { entity: t('label.application') })}
        />
      </Box>
    );
  }

  // As on the legacy install page, a registered plugin may replace the steps.
  const PluginClass = applicationsClassBase.appPluginRegistry[appData.name];
  const PluginInstall = PluginClass
    ? new PluginClass(appData.name, false).getAppInstallComponent?.(appData)
    : undefined;

  if (PluginInstall) {
    return <PluginInstall />;
  }

  const nextLabel = isLastStep ? t('label.install') : t('label.next');

  const renderStep = () => {
    switch (currentStep) {
      case 'details':
        return (
          <AppInstallDetailsStep
            appData={appData}
            footer={
              <StepFooter
                backLabel={t('label.cancel')}
                isLoading={isSaving}
                nextLabel={nextLabel}
                onBack={goBack}
                onNext={() => (isLastStep ? void install() : goNext())}
              />
            }
          />
        );
      case 'configure': {
        const ConfigurationComponent =
          applicationsClassBase.getModalAppConfigurationComponent();

        return jsonSchema ? (
          <ConfigurationComponent
            appData={{
              ...appData,
              appConfiguration: appConfiguration ?? appData.appConfiguration,
            }}
            cancelLabel={t('label.back')}
            isSaving={isSaving}
            jsonSchema={jsonSchema}
            showHint={showHint}
            submitLabel={nextLabel}
            onCancel={goBack}
            onSave={handleConfigSave}
          />
        ) : null;
      }
      case 'schedule':
        return (
          <Box direction="col">
            <ScheduleInterval
              defaultSchedule={defaultCron}
              includePeriodOptions={initialOptions}
              value={scheduleValue}
              onChange={setScheduleValue}
              onValidityChange={setIsScheduleValid}
            />
            <StepFooter
              backLabel={t('label.back')}
              isLoading={isSaving}
              isNextDisabled={!isScheduleValid}
              nextLabel={t('label.install')}
              onBack={goBack}
              onNext={() => void install(appConfiguration, ingestionRunner)}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box
      className="tw:px-8 tw:pb-8"
      data-testid="app-install"
      direction="col"
      gap={6}>
      <ProgressSteps
        currentStep={stepIndex}
        labelPlacement="attach"
        size="sm"
        steps={steps.map((step) => ({ id: step, title: t(STEP_LABEL[step]) }))}
        type="number"
      />
      {renderStep()}
    </Box>
  );
};

export default AppInstall;
