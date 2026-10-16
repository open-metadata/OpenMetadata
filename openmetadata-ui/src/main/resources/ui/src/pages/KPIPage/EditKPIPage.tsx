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
  Box,
  Button,
  FormField,
  FormItemLabel,
  HookForm,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { DateTime } from 'luxon';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityAttachmentProvider } from '../../components/common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';
import Loader from '../../components/common/Loader/Loader';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ROUTES } from '../../constants/constants';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { DataInsightChart } from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi, KpiTargetType } from '../../generated/dataInsight/kpi/kpi';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useAuth } from '../../hooks/authHooks';
import { useFqn } from '../../hooks/useFqn';
import { getKPIByName, patchKPI } from '../../rest/KpiAPI';
import { getDataInsightPathWithFqn } from '../../utils/DataInsightPureUtils';
import { getKPIChartType, KPIChartOptions } from '../../utils/KPI/KPIUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import KPIFormFields from './KPIFormFields';
import { KPIFormValues } from './KPIPage.interface';

const CHART_ITEMS = KPIChartOptions.map(({ label, value }) => ({
  id: value,
  label,
}));

const toFormValues = (kpi?: Kpi): KPIFormValues => ({
  chartType: kpi
    ? getKPIChartType(kpi.fullyQualifiedName as DataInsightChart) ?? null
    : null,
  displayName: kpi?.displayName ?? '',
  metricType: kpi?.metricType ?? KpiTargetType.Percentage,
  targetValue: kpi?.targetValue ?? 0,
  startDate: kpi ? DateTime.fromMillis(kpi.startDate) : null,
  endDate: kpi ? DateTime.fromMillis(kpi.endDate) : null,
  description: kpi?.description ?? '',
});

const EditKPIPage = () => {
  const { isAdminUser } = useAuth();
  const { fqn: kpiName } = useFqn();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const form = useForm<KPIFormValues>({ defaultValues: toFormValues() });

  const [kpiData, setKpiData] = useState<Kpi>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isUpdatingKPI, setIsUpdatingKPI] = useState<boolean>(false);

  const breadcrumb = useMemo(
    () => [
      {
        name: t('label.data-insight'),
        url: getDataInsightPathWithFqn(),
      },
      {
        name: t('label.kpi-list'),
        url: ROUTES.KPI_LIST,
      },
      {
        name: kpiData?.name ?? '',
        url: '',
        activeTitle: true,
      },
    ],
    [kpiData]
  );

  useEffect(() => {
    form.reset(toFormValues(kpiData));
  }, [kpiData, form]);

  const fetchKPI = async () => {
    setIsLoading(true);
    try {
      const response = await getKPIByName(kpiName, {
        fields: [
          TabSpecificField.START_DATE,
          TabSpecificField.END_DATE,
          TabSpecificField.TARGET_VALUE,
          TabSpecificField.DATA_INSIGHT_CHART,
          TabSpecificField.METRIC_TYPE,
        ],
      });
      setKpiData(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => navigate(-1);

  const handleSubmit = async (values: KPIFormValues) => {
    if (kpiData) {
      const { targetValue, description, displayName } = values;
      const startDate = values.startDate?.valueOf() ?? kpiData.startDate;
      const endDate = values.endDate?.valueOf() ?? kpiData.endDate;

      const updatedData = {
        ...kpiData,
        description,
        targetValue,
        displayName,
        endDate,
        startDate,
      };

      const patch = compare(kpiData, updatedData);

      setIsUpdatingKPI(true);
      try {
        await patchKPI(kpiData.id ?? '', patch);
        navigate(ROUTES.KPI_LIST);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsUpdatingKPI(false);
      }
    }
  };

  useEffect(() => {
    fetchKPI();
  }, [kpiName]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="edit-kpi-container">
            <TitleBreadcrumb className="m-t-0 my-4" titleLinks={breadcrumb} />
            <Typography as="p" className="text-base" data-testid="form-title">
              {t('label.edit-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-4"
              data-testid="kpi-form"
              form={form}
              id="kpi-form"
              onSubmit={form.handleSubmit(handleSubmit)}>
              <KPIFormFields isEditing chartItems={CHART_ITEMS} form={form} />
              <EntityAttachmentProvider
                entityFqn={kpiData?.fullyQualifiedName}
                entityType={EntityType.KPI}>
                <FormField control={form.control} name="description">
                  {({ field }) => (
                    <Box direction="col" gap={1}>
                      <FormItemLabel label={t('label.description')} />
                      <RichTextEditor
                        data-testid="description"
                        initialValue={kpiData?.description ?? ''}
                        placeHolder={t('message.write-your-description')}
                        onTextChange={field.onChange}
                      />
                    </Box>
                  )}
                </FormField>
              </EntityAttachmentProvider>
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal w-full justify-end"
                gap={2}
                itemClassName="layout-space-item">
                <Button
                  color="link-color"
                  data-testid="cancel-btn"
                  onClick={handleCancel}>
                  {t('label.go-back')}
                </Button>
                {isAdminUser ? (
                  <Tooltip arrow title={t('label.save')}>
                    <Button
                      color="primary"
                      data-testid="submit-btn"
                      isLoading={isUpdatingKPI}
                      size="sm"
                      type="submit">
                      {t('label.save')}
                    </Button>
                  </Tooltip>
                ) : null}
              </Box>
            </HookForm>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.edit-entity', {
        entity: t('label.kpi-uppercase'),
      })}
      secondPanel={{
        children: (
          <div data-testid="right-panel">
            <Typography as="p" className="text-base font-medium">
              {t('label.edit-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography>
            <Typography>{t('message.add-kpi-message')}</Typography>
          </div>
        ),
        className: 'content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(EditKPIPage);
