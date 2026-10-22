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
  HintText,
  HookForm,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { kebabCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import RichTextEditor from '../../components/common/RichTextEditor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { ADD_KPI_BREADCRUMB } from '../../constants/Breadcrumb.constants';
import { ROUTES } from '../../constants/constants';
import { TabSpecificField } from '../../enums/entity.enum';
import {
  CreateKpiRequest,
  KpiTargetType,
} from '../../generated/api/dataInsight/kpi/createKpiRequest';
import { Kpi } from '../../generated/dataInsight/kpi/kpi';
import { withPageLayout } from '../../hoc/withPageLayout';
import { getListKPIs, postKPI } from '../../rest/KpiAPI';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import {
  filterChartOptions,
  getDataInsightChartForKPI,
  KPIChartType,
} from '../../utils/KPI/KPIUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import KPIFormFields from './KPIFormFields';
import { KPIFormValues } from './KPIPage.interface';

const AddKPIPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const form = useForm<KPIFormValues>({
    defaultValues: {
      chartType: null,
      displayName: '',
      metricType: KpiTargetType.Percentage,
      targetValue: 0,
      startDate: null,
      endDate: null,
      description: '',
    },
  });

  const [isCreatingKPI, setIsCreatingKPI] = useState<boolean>(false);
  const [kpiList, setKpiList] = useState<Array<Kpi>>([]);
  const chartItems = useMemo(
    () =>
      filterChartOptions(kpiList).map(({ label, value }) => ({
        id: value,
        label,
      })),
    [kpiList]
  );

  const fetchKpiList = async () => {
    try {
      const response = await getListKPIs({
        fields: TabSpecificField.DATA_INSIGHT_CHART,
      });

      setKpiList(response.data);
    } catch {
      setKpiList([]);
    }
  };

  const handleCancel = () => navigate(-1);

  const handleSubmit = async (values: KPIFormValues) => {
    const { metricType } = values;
    const startDate = values.startDate?.valueOf() ?? 0;
    const endDate = values.endDate?.valueOf() ?? 0;

    const dataInsightChart = getDataInsightChartForKPI(
      values.chartType as KPIChartType,
      metricType
    );

    const formData: CreateKpiRequest = {
      dataInsightChart: dataInsightChart,
      description: values.description,
      name: kebabCase(`${values.displayName ?? ''} ${metricType}`),
      displayName: values.displayName,
      startDate,
      endDate,
      metricType,
      targetValue: values.targetValue,
    };

    setIsCreatingKPI(true);
    try {
      await postKPI(formData);
      navigate(ROUTES.KPI_LIST);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsCreatingKPI(false);
    }
  };

  useEffect(() => {
    fetchKpiList();
  }, []);

  const translatedKPIBreadcrumb = useMemo(
    () =>
      ADD_KPI_BREADCRUMB.map((option) => ({
        ...option,
        name: translateWithNestedKeys(option.name, option.nameData),
      })),
    [t]
  );

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
        children: (
          <div data-testid="add-kpi-container">
            <TitleBreadcrumb
              className="m-t-0 my-4"
              titleLinks={translatedKPIBreadcrumb}
            />
            <Typography
              as="p"
              className="text-base tw:mb-4!"
              data-testid="form-title">
              {t('label.add-new-entity', {
                entity: t('label.kpi-uppercase'),
              })}
            </Typography>
            <HookForm
              className="tw:flex tw:flex-col tw:gap-4"
              data-testid="kpi-form"
              form={form}
              id="kpi-form"
              onSubmit={form.handleSubmit(handleSubmit)}>
              <KPIFormFields chartItems={chartItems} form={form} />
              <FormField
                control={form.control}
                name="description"
                rules={{
                  required: t('label.field-required', {
                    field: t('label.description-kpi'),
                  }),
                }}>
                {({ field, fieldState }) => (
                  <Box direction="col" gap={1}>
                    <FormItemLabel required label={t('label.description')} />
                    <RichTextEditor
                      data-testid="description"
                      initialValue=""
                      placeHolder={t('message.write-your-description')}
                      onTextChange={field.onChange}
                    />
                    {fieldState.error && (
                      <HintText isInvalid>{fieldState.error.message}</HintText>
                    )}
                  </Box>
                )}
              </FormField>
              <Box
                inline
                align="center"
                className="layout-space layout-space-horizontal w-full justify-end"
                gap={2}
                itemClassName="layout-space-item">
                <Button
                  color="secondary"
                  data-testid="cancel-btn"
                  onClick={handleCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  data-testid="submit-btn"
                  form="kpi-form"
                  isLoading={isCreatingKPI}
                  type="submit">
                  {t('label.create')}
                </Button>
              </Box>
            </HookForm>
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-new-entity', {
        entity: t('label.kpi-uppercase'),
      })}
      secondPanel={{
        children: (
          <div data-testid="right-panel">
            <Typography as="p" className="text-base font-medium tw:mb-4!">
              {t('label.add-entity', {
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

export default withPageLayout(AddKPIPage);
