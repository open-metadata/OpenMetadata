/*
 *  Copyright 2024 Collate.
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
  FormField,
  FormItemLabel,
  Grid,
  HintText,
  HookForm,
  NumberInput,
  Typography,
} from '@openmetadata/ui-core-components';
import { Select } from 'antd';
import { AxiosError } from 'axios';
import { FocusEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { OPEN_METADATA } from '../../constants/service-guide.constant';
import {
  LineageLayer,
  LineageSettings,
  PipelineViewMode,
} from '../../generated/configuration/lineageSettings';
import { Settings, SettingType } from '../../generated/settings/settings';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import {
  getSettingsByType,
  updateSettingsConfig,
} from '../../rest/settingConfigAPI';
import { getLayoutGutter } from '../../utils/common/layout.utils';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';

const LineageConfigPage = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [activeField, setActiveField] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const form = useForm<LineageSettings>({ mode: 'onChange' });
  const navigate = useNavigate();
  const { setAppPreferences, appPreferences } = useApplicationStore();
  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.lineage')
      ),
    []
  );

  const fetchSearchConfig = async () => {
    try {
      setIsLoading(true);

      const config = await getSettingsByType(SettingType.LineageSettings);
      form.reset(config as LineageSettings);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    setActiveField(event.target.id);
  }, []);

  const handleSave = useCallback(async (values: LineageSettings) => {
    try {
      setIsUpdating(true);

      const configData = {
        config_type: SettingType.LineageSettings,
        config_value: {
          upstreamDepth: Number(values.upstreamDepth),
          downstreamDepth: Number(values.downstreamDepth),
          lineageLayer: values.lineageLayer,
          pipelineViewMode: values.pipelineViewMode,
        },
      };

      const { data } = await updateSettingsConfig(configData as Settings);
      showSuccessToast(
        t('server.update-entity-success', {
          entity: t('label.lineage-config'),
        })
      );

      const lineageConfig = data.config_value as LineageSettings;

      // Update lineage config in store
      setAppPreferences({
        ...appPreferences,
        lineageConfig,
      });
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div>
      <ResizablePanels
        className="content-height-with-resizable-panel"
        firstPanel={{
          className: 'content-resizable-panel-container',
          cardClassName: 'max-width-md m-x-auto',
          allowScroll: true,
          children: (
            <div data-testid="add-metric-container">
              <Grid
                className="layout-row layout-grid"
                style={{ ...getLayoutGutter(16, 16) }}>
                <Grid.Item className="layout-column" span={24}>
                  <TitleBreadcrumb titleLinks={breadcrumbs} />
                </Grid.Item>

                <Grid.Item className="layout-column" span={24}>
                  <Typography
                    as="h5"
                    className="m-b-0"
                    data-testid="heading"
                    size="text-md"
                    weight="semibold">
                    {t('label.lineage')}
                  </Typography>
                </Grid.Item>
                <Grid.Item className="layout-column" span={24}>
                  {/* Focus bubbles from fields to select their documentation. */}
                  {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
                  <section
                    aria-label={t('label.lineage-config')}
                    onFocus={handleFieldFocus}>
                    <HookForm
                      form={form}
                      id="lineage-config"
                      onSubmit={form.handleSubmit(handleSave)}>
                      <FormField
                        control={form.control}
                        name="upstreamDepth"
                        rules={{
                          required: t('message.field-text-is-required', {
                            fieldText: t('label.upstream-depth'),
                          }),
                          min: {
                            value: 0,
                            message: t('message.entity-size-less-than', {
                              entity: t('label.upstream-depth'),
                              min: 0,
                            }),
                          },
                        }}>
                        {({ field, fieldState }) => (
                          <Box className="m-t-sm" direction="col" gap={2}>
                            <FormItemLabel
                              required
                              label={t('label.upstream-depth')}
                            />
                            <NumberInput
                              {...field}
                              aria-label={t('label.upstream-depth')}
                              className="w-full"
                              id="root/upstreamDepth"
                              inputDataTestId="field-upstream"
                              isInvalid={!!fieldState.error}
                            />
                            {fieldState.error && (
                              <HintText isInvalid>
                                {fieldState.error.message}
                              </HintText>
                            )}
                          </Box>
                        )}
                      </FormField>

                      <FormField
                        control={form.control}
                        name="downstreamDepth"
                        rules={{
                          required: t('message.field-text-is-required', {
                            fieldText: t('label.downstream-depth'),
                          }),
                          min: {
                            value: 0,
                            message: t('message.entity-size-less-than', {
                              entity: t('label.downstream-depth'),
                              min: 0,
                            }),
                          },
                        }}>
                        {({ field, fieldState }) => (
                          <Box className="m-t-sm" direction="col" gap={2}>
                            <FormItemLabel
                              required
                              label={t('label.downstream-depth')}
                            />
                            <NumberInput
                              {...field}
                              aria-label={t('label.downstream-depth')}
                              className="w-full"
                              id="root/downstreamDepth"
                              inputDataTestId="field-downstream"
                              isInvalid={!!fieldState.error}
                            />
                            {fieldState.error && (
                              <HintText isInvalid>
                                {fieldState.error.message}
                              </HintText>
                            )}
                          </Box>
                        )}
                      </FormField>

                      <FormField control={form.control} name="lineageLayer">
                        {({ field, fieldState }) => (
                          <Box className="m-t-sm" direction="col" gap={2}>
                            <FormItemLabel
                              label={t('label.lineage-layer')}
                              required={false}
                            />
                            <Select
                              {...field}
                              aria-label={t('label.lineage-layer')}
                              data-testid="field-lineage-layer"
                              id="root/lineageLayer">
                              <Select.Option value={LineageLayer.EntityLineage}>
                                {t('label.entity-lineage')}
                              </Select.Option>
                              <Select.Option
                                value={LineageLayer.ColumnLevelLineage}>
                                {t('label.column-level-lineage')}
                              </Select.Option>
                              <Select.Option
                                value={LineageLayer.DataObservability}>
                                {t('label.data-observability')}
                              </Select.Option>
                            </Select>
                            {fieldState.error && (
                              <HintText isInvalid>
                                {fieldState.error.message}
                              </HintText>
                            )}
                          </Box>
                        )}
                      </FormField>

                      <FormField control={form.control} name="pipelineViewMode">
                        {({ field, fieldState }) => (
                          <Box className="m-t-sm" direction="col" gap={2}>
                            <FormItemLabel
                              label={t('label.pipeline-view-mode')}
                              required={false}
                            />
                            <Select
                              {...field}
                              aria-label={t('label.pipeline-view-mode')}
                              data-testid="field-pipeline-view-mode"
                              id="root/pipelineViewMode">
                              <Select.Option value={PipelineViewMode.Edge}>
                                {t('label.edge')}
                              </Select.Option>
                              <Select.Option value={PipelineViewMode.Node}>
                                {t('label.node')}
                              </Select.Option>
                            </Select>
                            {fieldState.error && (
                              <HintText isInvalid>
                                {fieldState.error.message}
                              </HintText>
                            )}
                          </Box>
                        )}
                      </FormField>
                    </HookForm>
                  </section>
                  <Box className="layout-row m-b-xl" justify="end" wrap="wrap">
                    <Box
                      className="layout-column d-flex justify-end gap-2"
                      style={{ maxWidth: '100%', flex: '0 0 100%' }}>
                      <Button
                        color="secondary"
                        data-testid="cancel-button"
                        onClick={() => navigate(-1)}>
                        {t('label.cancel')}
                      </Button>
                      <Button
                        color="primary"
                        data-testid="save-button"
                        form="lineage-config"
                        isLoading={isUpdating}
                        type="submit">
                        {t('label.save')}
                      </Button>
                    </Box>
                  </Box>
                </Grid.Item>
              </Grid>
            </div>
          ),
          minWidth: 700,
          flex: 0.7,
        }}
        pageTitle={t('label.lineage-config')}
        secondPanel={{
          className: 'service-doc-panel content-resizable-panel-container',
          minWidth: 400,
          flex: 0.3,
          children: (
            <ServiceDocPanel
              activeField={activeField}
              serviceName="LineageConfiguration"
              serviceType={OPEN_METADATA}
            />
          ),
        }}
      />
    </div>
  );
};

export default withPageLayout(LineageConfigPage);
