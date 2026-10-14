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
  Grid,
  HookForm,
  Input,
  Select,
  Typography,
} from '@openmetadata/ui-core-components';
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

interface LineageConfigFormValues {
  upstreamDepth: string;
  downstreamDepth: string;
  lineageLayer?: LineageLayer;
  pipelineViewMode?: PipelineViewMode;
}

type DepthField = 'upstreamDepth' | 'downstreamDepth';

const toFormValues = (config?: LineageSettings): LineageConfigFormValues => ({
  upstreamDepth: String(config?.upstreamDepth ?? ''),
  downstreamDepth: String(config?.downstreamDepth ?? ''),
  lineageLayer: config?.lineageLayer,
  pipelineViewMode: config?.pipelineViewMode,
});

const LineageConfigPage = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [activeField, setActiveField] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const form = useForm<LineageConfigFormValues>({
    defaultValues: toFormValues(),
  });
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
      form.reset(toFormValues(config as LineageSettings));
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFieldFocus = useCallback((event: FocusEvent<HTMLElement>) => {
    setActiveField(event.target.id);
  }, []);

  const handleSave = async (values: LineageConfigFormValues) => {
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
      form.reset(toFormValues(lineageConfig));

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
  };

  useEffect(() => {
    fetchSearchConfig();
  }, []);

  const layerItems = [
    { id: LineageLayer.EntityLineage, label: t('label.entity-lineage') },
    {
      id: LineageLayer.ColumnLevelLineage,
      label: t('label.column-level-lineage'),
    },
    {
      id: LineageLayer.DataObservability,
      label: t('label.data-observability'),
    },
  ];
  const viewModeItems = [
    { id: PipelineViewMode.Edge, label: t('label.edge') },
    { id: PipelineViewMode.Node, label: t('label.node') },
  ];

  const renderDepthField = (
    name: DepthField,
    label: string,
    testId: string
  ) => (
    <FormField
      control={form.control}
      name={name}
      rules={{
        required: t('label.field-required', { field: label }),
        min: {
          value: 0,
          message: t('message.entity-size-less-than', {
            entity: label,
            min: 0,
          }),
        },
      }}>
      {({ field, fieldState }) => (
        <Input
          isRequired
          hint={fieldState.error?.message}
          id={`root/${name}`}
          inputDataTestId={testId}
          isInvalid={fieldState.invalid}
          label={label}
          type="number"
          value={field.value}
          onBlur={field.onBlur}
          onChange={field.onChange}
        />
      )}
    </FormField>
  );

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
                  {/* Tracks the focused field for the doc panel; focus events bubble. */}
                  <div role="presentation" onFocus={handleFieldFocus}>
                    <HookForm
                      className="tw:flex tw:flex-col tw:gap-4"
                      form={form}
                      id="lineage-config"
                      onSubmit={form.handleSubmit(handleSave)}>
                      {renderDepthField(
                        'upstreamDepth',
                        t('label.upstream-depth'),
                        'field-upstream'
                      )}
                      {renderDepthField(
                        'downstreamDepth',
                        t('label.downstream-depth'),
                        'field-downstream'
                      )}
                      <FormField control={form.control} name="lineageLayer">
                        {({ field }) => (
                          <Select
                            data-testid="field-lineage-layer"
                            id="root/lineageLayer"
                            items={layerItems}
                            label={t('label.lineage-layer')}
                            selectedKey={field.value ?? null}
                            onSelectionChange={(key) =>
                              key !== null &&
                              field.onChange(key as LineageLayer)
                            }>
                            {(item) => (
                              <Select.Item id={item.id} label={item.label} />
                            )}
                          </Select>
                        )}
                      </FormField>
                      <FormField control={form.control} name="pipelineViewMode">
                        {({ field }) => (
                          <Select
                            data-testid="field-pipeline-view-mode"
                            id="root/pipelineViewMode"
                            items={viewModeItems}
                            label={t('label.pipeline-view-mode')}
                            selectedKey={field.value ?? null}
                            onSelectionChange={(key) =>
                              key !== null &&
                              field.onChange(key as PipelineViewMode)
                            }>
                            {(item) => (
                              <Select.Item id={item.id} label={item.label} />
                            )}
                          </Select>
                        )}
                      </FormField>
                    </HookForm>
                  </div>
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
