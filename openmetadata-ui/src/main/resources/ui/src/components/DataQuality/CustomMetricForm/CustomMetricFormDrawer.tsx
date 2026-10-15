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
import { AxiosError } from 'axios';
import { omit } from 'lodash';
import QueryString from 'qs';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CustomMetric, Table } from '../../../generated/entity/data/table';
import useCustomLocation from '../../../hooks/useCustomLocation/useCustomLocation';
import { putCustomMetric } from '../../../rest/customMetricAPI';
import { submitAndClose } from '../../../utils/FormDrawerUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { useFormDrawerWithHook } from '../../common/atoms/drawer/useFormDrawer';
import SingleColumnProfile from '../../Database/Profiler/TableProfiler/SingleColumnProfile';
import TableProfilerChart from '../../Database/Profiler/TableProfiler/TableProfilerChart/TableProfilerChart';
import CustomMetricForm from './CustomMetricForm.component';

export interface CustomMetricFormDrawerProps {
  open: boolean;
  isColumnMetric: boolean;
  /** The metric being edited; omit to add a new one. */
  metric?: CustomMetric;
  table?: Table;
  onClose: () => void;
  onSuccess: (table: Table) => void;
}

const CustomMetricFormDrawer = ({
  open,
  isColumnMetric,
  metric,
  table,
  onClose,
  onSuccess,
}: CustomMetricFormDrawerProps) => {
  const { t } = useTranslation();
  const location = useCustomLocation();
  const navigate = useNavigate();
  const isEditMode = Boolean(metric);
  const form = useForm<CustomMetric>({
    defaultValues: { name: '', expression: '' },
  });
  const columnName = useWatch({ control: form.control, name: 'columnName' });

  const searchParams = useMemo(() => {
    const param = location.search;

    return QueryString.parse(
      param.startsWith('?') ? param.substring(1) : param
    );
  }, [location.search]);
  const activeColumnFqn = searchParams.activeColumnFqn as string | undefined;

  const selectedColumnFqn = useMemo(
    () =>
      table?.columns.find((column) => column.name === columnName)
        ?.fullyQualifiedName,
    [table, columnName]
  );

  // The host stays mounted between opens, so seed the form on every open: the
  // edited metric, or the profiler's active column for a new column metric.
  useEffect(() => {
    if (!open) {
      return;
    }
    form.reset({
      name: metric?.name ?? '',
      expression: metric?.expression ?? '',
      columnName:
        metric?.columnName ??
        table?.columns.find(
          (column) => column.fullyQualifiedName === activeColumnFqn
        )?.name,
    });
    // Seed only on open/metric change: re-seeding when the host refreshes
    // `table` would wipe what the user has already typed.
  }, [open, metric]);

  const handleSubmit = useCallback(
    async ({ name, expression, columnName }: CustomMetric) => {
      if (!table) {
        return;
      }
      const values = {
        name,
        expression,
        ...(isColumnMetric ? { columnName } : {}),
      };
      try {
        const { data } = await putCustomMetric(
          table.id,
          metric ? { ...omit(metric, ['id']), ...values } : values
        );
        showSuccessToast(
          t(
            isEditMode
              ? 'server.update-entity-success'
              : 'server.create-entity-success',
            { entity: name }
          )
        );
        onSuccess(data);
        // Land on the metric's column so its new graph is in view, as the
        // former add page did when it navigated back.
        if (
          isColumnMetric &&
          selectedColumnFqn &&
          selectedColumnFqn !== activeColumnFqn
        ) {
          navigate({
            search: QueryString.stringify({
              ...searchParams,
              activeColumnFqn: selectedColumnFqn,
            }),
          });
        }
      } catch (error) {
        showErrorToast(error as AxiosError);

        // Rethrow so submitAndClose keeps the drawer open for a retry.
        throw error;
      }
    },
    [
      table,
      metric,
      isColumnMetric,
      isEditMode,
      selectedColumnFqn,
      activeColumnFqn,
      searchParams,
      navigate,
      onSuccess,
      t,
    ]
  );

  const closeDrawerRef = useRef<() => void>(() => undefined);
  const submit = (values: CustomMetric) =>
    submitAndClose(values, handleSubmit, () => closeDrawerRef.current());

  const handleDismiss = useCallback(() => {
    form.reset();
    onClose();
  }, [form, onClose]);

  const profilePreview = isColumnMetric ? (
    <SingleColumnProfile
      activeColumnFqn={selectedColumnFqn ?? ''}
      tableDetails={table}
    />
  ) : (
    <TableProfilerChart
      entityFqn={table?.fullyQualifiedName}
      showHeader={false}
      tableDetails={table}
    />
  );

  const { formDrawer, openDrawer, closeDrawer, isOpen } =
    useFormDrawerWithHook<CustomMetric>({
      // The core SlideoutMenu overlay has no z-index, so positioned page
      // elements (the profiler tabs) paint through it; 40 matches the test case
      // drawer and stays below select popovers (z-50).
      className: 'custom-metric-form-drawer tw:z-40',
      testId: 'custom-metric-form-drawer',
      title: isEditMode
        ? t('label.edit-entity', { entity: metric?.name })
        : t('label.add-entity-metric', {
            entity: isColumnMetric ? t('label.column') : t('label.table'),
          }),
      hookForm: form,
      width: '80vw',
      // Columns scroll on their own: drop Content's padding, gap and stacking.
      body: { className: 'tw:flex-row tw:gap-0 tw:px-0 tw:md:px-0' },
      form: (
        <>
          <div className="drawer-form-content tw:min-w-95 tw:flex-1 tw:overflow-y-auto tw:px-4 tw:py-6 tw:md:px-6">
            <CustomMetricForm
              form={form}
              isColumnMetric={isColumnMetric}
              isEditMode={isEditMode}
              table={table}
              onFinish={submit}
            />
          </div>
          <div
            className="tw:w-2/5 tw:shrink-0 tw:overflow-y-auto tw:border-l tw:border-secondary tw:bg-secondary tw:p-6"
            data-testid="custom-metric-profile-preview">
            {profilePreview}
          </div>
        </>
      ),
      submitLabel: isEditMode ? t('label.save') : t('label.create'),
      submitTestId: 'submit-button',
      cancelTestId: 'cancel-button',
      onClose: handleDismiss,
      onSubmit: submit,
    });

  closeDrawerRef.current = closeDrawer;

  useEffect(() => {
    if (open) {
      openDrawer();
    } else if (isOpen) {
      closeDrawer();
    }
  }, [open, isOpen, openDrawer, closeDrawer]);

  return formDrawer;
};

export default CustomMetricFormDrawer;
