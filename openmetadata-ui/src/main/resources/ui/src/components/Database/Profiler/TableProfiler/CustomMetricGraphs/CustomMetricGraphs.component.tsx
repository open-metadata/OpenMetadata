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
  Button,
  Dialog,
  Dropdown,
  Modal,
  ModalOverlay,
} from '@openmetadata/ui-core-components';
import {
  AreaChart,
  type ChartTooltipRenderProps,
  type ChartYAxisProps,
} from '@openmetadata/ui-core-components/charts';
import { DotsVertical } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, last, omit, toPairs } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CustomMetric } from '../../../../../generated/entity/data/table';
import { Operation } from '../../../../../generated/entity/policies/policy';
import {
  deleteCustomMetric,
  putCustomMetric,
} from '../../../../../rest/customMetricAPI';
import {
  axisTickFormatter,
  tooltipFormatter,
} from '../../../../../utils/ChartUtils';
import {
  chartTooltipRows,
  DQTooltipContent,
} from '../../../../../utils/DataQuality/CustomDQTooltip.component';
import { formatDateTimeLong } from '../../../../../utils/date-time/DateTimeUtils';
import { getDerivedPermissionFlags } from '../../../../../utils/PermissionDerivation';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import DeleteModal from '../../../../common/DeleteModal/DeleteModal';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import CustomMetricForm from '../../../../DataQuality/CustomMetricForm/CustomMetricForm.component';
import { MetricChartType } from '../../ProfilerDashboard/profilerDashboard.interface';
import ProfilerStateWrapper from '../../ProfilerStateWrapper/ProfilerStateWrapper.component';
import { useTableProfiler } from '../TableProfilerProvider';
import './custom-metric-graphs.style.less';
import {
  CustomMetricGraphsProps,
  MenuOptions,
} from './CustomMetricGraphs.interface';

type MetricRow = MetricChartType['data'][number];

const CHART_HEIGHT = 300;

// The axis spans the data rather than starting at 0.
const Y_AXIS: ChartYAxisProps = {
  min: 'dataMin',
  max: 'dataMax',
  formatter: (value) => String(axisTickFormatter(Number(value))),
};

const TOOLTIP: ChartTooltipRenderProps<MetricRow> = {
  render: (items, row) => (
    <DQTooltipContent
      header={formatDateTimeLong(Number(row?.timestamp ?? 0))}
      rows={chartTooltipRows(items)}
      valueFormatter={(value) => tooltipFormatter(value)}
    />
  ),
};

const CustomMetricGraphs = ({
  customMetricsGraphData,
  isLoading,
  customMetrics,
}: CustomMetricGraphsProps) => {
  const { t } = useTranslation();
  const {
    permissions,
    customMetric: tableDetails,
    onCustomMetricUpdate,
  } = useTableProfiler();
  const editPermission =
    permissions &&
    getDerivedPermissionFlags(permissions).can(Operation.EditDataProfile);
  const deletePermission = permissions?.Delete || false;

  const [selectedMetrics, setSelectedMetrics] = useState<CustomMetric>();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const seriesByMetric = useMemo(
    () =>
      Object.fromEntries(
        Object.keys(customMetricsGraphData ?? {}).map((key) => [
          key,
          [{ key, name: key }],
        ])
      ),
    [customMetricsGraphData]
  );

  const items = useMemo(
    () => [
      {
        key: MenuOptions.EDIT,
        label: t('label.edit'),
        disabled: !editPermission,
      },
      {
        key: MenuOptions.DELETE,
        label: t('label.delete'),
        disabled: !deletePermission,
      },
    ],
    [editPermission, deletePermission]
  );

  const handleModalCancel = () => {
    setIsDeleteModalVisible(false);
    setIsEditModalVisible(false);
    setSelectedMetrics(undefined);
  };

  const handleDeleteClick = async () => {
    if (tableDetails && selectedMetrics) {
      setIsActionLoading(true);
      try {
        const { data } = await deleteCustomMetric({
          tableId: tableDetails.id,
          customMetricName: selectedMetrics.name,
          columnName: selectedMetrics.columnName,
        });
        showSuccessToast(
          t('server.entity-deleted-successfully', {
            entity: selectedMetrics.name,
          })
        );
        onCustomMetricUpdate(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        handleModalCancel();
        setIsActionLoading(false);
      }
    }
  };

  const handleEditFormSubmit = async (values: CustomMetric) => {
    if (tableDetails) {
      setIsActionLoading(true);
      const updatedMetric = {
        ...omit(selectedMetrics, ['id']),
        ...values,
      };

      try {
        const { data } = await putCustomMetric(tableDetails.id, updatedMetric);
        showSuccessToast(
          t('server.update-entity-success', {
            entity: selectedMetrics?.name,
          })
        );
        onCustomMetricUpdate(data);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        handleModalCancel();
        setIsActionLoading(false);
      }
    }
  };

  const handleMenuClick = (key: string, metricName: string) => {
    setSelectedMetrics(
      customMetrics?.find((metric) => metric.name === metricName)
    );
    setOpenMenuKey(null);

    switch (key) {
      case MenuOptions.EDIT:
        setIsEditModalVisible(true);

        break;
      case MenuOptions.DELETE:
        setIsDeleteModalVisible(true);

        break;
      default:
        break;
    }
  };

  return (
    <div
      className="tw:flex tw:flex-col tw:gap-8"
      data-testid="custom-metric-graph-container">
      {toPairs(customMetricsGraphData).map(([key, metric]) => {
        const metricDetails = customMetrics?.find(
          (metric) => metric.name === key
        );

        return isUndefined(metricDetails) ? null : (
          <div key={key}>
            <ProfilerStateWrapper
              data-testid={`${key}-custom-metrics`}
              isLoading={isLoading}
              profilerLatestValueProps={{
                information: [
                  {
                    latestValue: last(metric)?.[key] ?? '--',
                    title: t('label.count'),
                    dataKey: key,
                  },
                ],
                extra:
                  editPermission || deletePermission ? (
                    <Dropdown.Root
                      isOpen={openMenuKey === key}
                      onOpenChange={(isOpen) =>
                        setOpenMenuKey(isOpen ? key : null)
                      }>
                      <Button
                        color="secondary"
                        data-testid={`${key}-custom-metrics-menu`}
                        iconLeading={DotsVertical}
                        size="sm"
                      />
                      <Dropdown.Popover className="tw:w-max">
                        <Dropdown.Menu items={items}>
                          {(item) => (
                            <Dropdown.Item
                              id={item.key}
                              isDisabled={item.disabled}
                              label={item.label}
                              onAction={() => handleMenuClick(item.key, key)}
                            />
                          )}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown.Root>
                  ) : undefined,
              }}
              title={key}>
              <div>
                {isEmpty(metric) ? (
                  <div className="tw:flex tw:h-full tw:w-full tw:items-center tw:justify-center">
                    <ErrorPlaceHolder className="mt-0-important" />
                  </div>
                ) : (
                  <div className="tw:w-full" id={`${key}-graph`}>
                    <AreaChart
                      ariaLabel={key}
                      data={metric}
                      height={CHART_HEIGHT}
                      series={seriesByMetric[key]}
                      tooltip={TOOLTIP}
                      xKey="formattedTimestamp"
                      yAxis={Y_AXIS}
                    />
                  </div>
                )}
              </div>
            </ProfilerStateWrapper>
          </div>
        );
      })}
      <DeleteModal
        entityTitle={selectedMetrics?.name ?? t('label.custom-metric')}
        isDeleting={isActionLoading}
        message={t('message.permanently-delete-common-message', {
          entity: (
            selectedMetrics?.name ?? t('label.custom-metric')
          ).toLowerCase(),
        })}
        open={isDeleteModalVisible}
        onCancel={handleModalCancel}
        onDelete={handleDeleteClick}
      />
      {isEditModalVisible && !isUndefined(selectedMetrics) && (
        <ModalOverlay
          isOpen={isEditModalVisible}
          onOpenChange={(open) => !open && handleModalCancel()}>
          <Modal>
            <Dialog
              title={t('label.edit-entity', { entity: selectedMetrics.name })}
              width={650}>
              <Dialog.Content>
                <CustomMetricForm
                  isEditMode
                  initialValues={selectedMetrics}
                  isColumnMetric={!isUndefined(selectedMetrics.columnName)}
                  table={tableDetails}
                  onFinish={handleEditFormSubmit}
                />
              </Dialog.Content>
              <Dialog.Footer>
                <Button
                  color="secondary"
                  isDisabled={isActionLoading}
                  size="md"
                  onPress={handleModalCancel}>
                  {t('label.cancel')}
                </Button>
                <Button
                  color="primary"
                  form="custom-metric-form"
                  isLoading={isActionLoading}
                  size="md"
                  type="submit">
                  {t('label.save')}
                </Button>
              </Dialog.Footer>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </div>
  );
};

export default CustomMetricGraphs;
