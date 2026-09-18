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
import type { AxiosError } from 'axios';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { createMetric } from '../../../rest/metricsAPI';
import { submitAndClose } from '../../../utils/FormDrawerUtils';
import { getEntityDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import AddMetricForm, { METRIC_FORM_DEFAULTS } from './AddMetricForm.component';
import { MetricFormValues } from './AddMetricForm.interface';
import { transformMetricFormData } from './AddMetricForm.utils';

/**
 * Encapsulates the "create metric" drawer — form, submit, and the drawer chrome
 * — so the metrics list page and the metric hierarchy card can open the same
 * drawer. `openDrawer(parentMetricFqn)` opens it as a child-metric form when a
 * parent FQN is supplied. `onSuccess` runs after a successful create.
 */
export const useMetricCreateDrawer = (onSuccess?: () => void) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [parentMetricFqn, setParentMetricFqn] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const form = useForm<MetricFormValues>({
    defaultValues: METRIC_FORM_DEFAULTS,
  });

  const handleCreate = useCallback(
    async (data: MetricFormValues) => {
      setIsLoading(true);
      try {
        const payload = transformMetricFormData(data, parentMetricFqn);
        const metric = await createMetric(payload);
        form.reset(METRIC_FORM_DEFAULTS);
        navigate(
          getEntityDetailsPath(
            EntityType.METRIC,
            metric.fullyQualifiedName ?? metric.name
          )
        );
      } catch (error) {
        showErrorToast(error as AxiosError);

        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [form, navigate, parentMetricFqn]
  );

  const {
    formDrawer,
    openDrawer: openFormDrawer,
    closeDrawer,
  } = useFormDrawerWithHook<MetricFormValues>({
    title: t('label.add-entity', { entity: t('label.metric') }),
    width: 670,
    closeOnEscape: false,
    closeOnBackdrop: false,
    hookForm: form,
    submitTestId: 'create-button',
    form: (
      <AddMetricForm
        form={form}
        parentMetricFqn={parentMetricFqn}
        onSubmit={(data: MetricFormValues): Promise<void> =>
          submitAndClose(data, handleCreate, closeDrawer, onSuccess)
        }
      />
    ),
    onSubmit: (data: MetricFormValues): Promise<void> =>
      submitAndClose(data, handleCreate, closeDrawer, onSuccess),
    loading: isLoading,
  });

  const openDrawer = useCallback(
    (nextParentMetricFqn?: string) => {
      setParentMetricFqn(nextParentMetricFqn);
      form.reset(METRIC_FORM_DEFAULTS);
      openFormDrawer();
    },
    [form, openFormDrawer]
  );

  return { formDrawer, openDrawer, closeDrawer };
};
