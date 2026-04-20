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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { DotsVertical } from '@untitledui/icons';
import { Form, Modal } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, last, omit, toPairs } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BLUE_600,
  BLUE_CHART_AREA_FILL,
  CHART_CURSOR_STROKE,
} from '../../../../../constants/Color.constants';
import { GRAPH_BACKGROUND_COLOR } from '../../../../../constants/constants';
import { EntityType } from '../../../../../enums/entity.enum';
import { CustomMetric } from '../../../../../generated/entity/data/table';
import { Operation } from '../../../../../generated/entity/policies/policy';
import {
  deleteCustomMetric,
  putCustomMetric,
} from '../../../../../rest/customMetricAPI';
import {
  axisTickFormatter,
  createHorizontalGridLineRenderer,
  tooltipFormatter,
} from '../../../../../utils/ChartUtils';
import { CustomDQTooltip } from '../../../../../utils/DataQuality/DataQualityUtils';
import { formatDateTimeLong } from '../../../../../utils/date-time/DateTimeUtils';
import { getPrioritizedEditPermission } from '../../../../../utils/PermissionsUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import DeleteWidgetModal from '../../../../common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import CustomMetricForm from '../../../../DataQuality/CustomMetricForm/CustomMetricForm.component';
import ProfilerStateWrapper from '../../ProfilerStateWrapper/ProfilerStateWrapper.component';
import { useTableProfiler } from '../TableProfilerProvider';
import './custom-metric-graphs.style.less';
import {
  CustomMetricGraphsProps,
  MenuOptions,
} from './CustomMetricGraphs.interface';

const CustomMetricGraphs = ({
  customMetricsGraphData,
  isLoading,
  customMetrics,
}: CustomMetricGraphsProps) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<CustomMetric>();
  const {
    permissions,
    customMetric: tableDetails,
    onCustomMetricUpdate,
  } = useTableProfiler();
  const editPermission =
    permissions &&
    getPrioritizedEditPermission(permissions, Operation.EditDataProfile);
  const deletePermission = permissions?.Delete || false;

  const [selectedMetrics, setSelectedMetrics] = useState<CustomMetric>();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  const renderHorizontalGridLine = useMemo(
    () => createHorizontalGridLineRenderer(),
    []
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
                    color: BLUE_600,
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
                  <ResponsiveContainer
                    className="custom-legend"
                    debounce={200}
                    id={`${key}-graph`}
                    minHeight={300}>
                    <ComposedChart
                      className="w-full"
                      data={metric}
                      margin={{ left: 16 }}>
                      <CartesianGrid
                        horizontal={renderHorizontalGridLine}
                        stroke={GRAPH_BACKGROUND_COLOR}
                        strokeDasharray="3 3"
                        vertical={false}
                      />
                      <XAxis
                        axisLine={false}
                        dataKey="formattedTimestamp"
                        padding={{ left: 16, right: 16 }}
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                      />

                      <YAxis
                        axisLine={false}
                        domain={['min', 'max']}
                        padding={{ top: 16, bottom: 16 }}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(props) => axisTickFormatter(props)}
                        tickLine={false}
                        type="number"
                      />

                      <Tooltip
                        content={
                          <CustomDQTooltip
                            dateTimeFormatter={formatDateTimeLong}
                            timeStampKey="timestamp"
                            valueFormatter={(value) => tooltipFormatter(value)}
                          />
                        }
                        cursor={{
                          stroke: CHART_CURSOR_STROKE,
                          strokeDasharray: '3 3',
                        }}
                      />

                      <Line
                        dataKey={key}
                        name={key}
                        stroke={BLUE_600}
                        type="monotone"
                      />
                      <Area
                        dataKey={key}
                        fill={BLUE_CHART_AREA_FILL}
                        name={key}
                        stroke={BLUE_600}
                        type="monotone"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </ProfilerStateWrapper>
          </div>
        );
      })}
      <DeleteWidgetModal
        allowSoftDelete={false}
        entityName={selectedMetrics?.name ?? t('label.custom-metric')}
        entityType={EntityType.CUSTOM_METRIC}
        isDeleting={isActionLoading}
        visible={isDeleteModalVisible}
        onCancel={handleModalCancel}
        onDelete={handleDeleteClick}
      />
      {isEditModalVisible && !isUndefined(selectedMetrics) && (
        <Modal
          centered
          destroyOnClose
          cancelButtonProps={{ disabled: isActionLoading }}
          closable={false}
          okButtonProps={{ loading: isActionLoading }}
          okText={t('label.save')}
          open={isEditModalVisible}
          title={t('label.edit-entity', { entity: selectedMetrics.name })}
          width={650}
          onCancel={handleModalCancel}
          onOk={() => form.submit()}>
          <CustomMetricForm
            isEditMode
            form={form}
            initialValues={selectedMetrics}
            isColumnMetric={!isUndefined(selectedMetrics.columnName)}
            table={tableDetails}
            onFinish={handleEditFormSubmit}
          />
        </Modal>
      )}
    </div>
  );
};

export default CustomMetricGraphs;
