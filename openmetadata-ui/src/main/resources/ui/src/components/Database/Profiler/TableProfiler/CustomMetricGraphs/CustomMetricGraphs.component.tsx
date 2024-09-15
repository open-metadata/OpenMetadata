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
  Card,
  Col,
  Dropdown,
  Form,
  Modal,
  Row,
  Typography,
} from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined, last, omit, toPairs } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ReactComponent as IconDropdown } from '../../../../../assets/svg/menu.svg';
import { GRAPH_BACKGROUND_COLOR } from '../../../../../constants/constants';
import { TOTAL_ENTITY_CHART_COLOR } from '../../../../../constants/DataInsight.constants';
import { PAGE_HEADERS } from '../../../../../constants/PageHeaders.constant';
import { EntityType } from '../../../../../enums/entity.enum';
import { CustomMetric } from '../../../../../generated/entity/data/table';
import {
  deleteCustomMetric,
  putCustomMetric,
} from '../../../../../rest/customMetricAPI';
import {
  axisTickFormatter,
  tooltipFormatter,
} from '../../../../../utils/ChartUtils';
import { getRandomHexColor } from '../../../../../utils/DataInsightUtils';
import {
  showErrorToast,
  showSuccessToast,
} from '../../../../../utils/ToastUtils';
import DeleteWidgetModal from '../../../../common/DeleteWidget/DeleteWidgetModal';
import ErrorPlaceHolder from '../../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import CustomMetricForm from '../../../../DataQuality/CustomMetricForm/CustomMetricForm.component';
import PageHeader from '../../../../PageHeader/PageHeader.component';
import ProfilerLatestValue from '../../ProfilerLatestValue/ProfilerLatestValue';
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
    permissions?.EditAll || permissions?.EditDataProfile || false;
  const deletePermission = permissions?.Delete || false;

  const [selectedMetrics, setSelectedMetrics] = useState<CustomMetric>();
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
    <Row data-testid="custom-metric-graph-container" gutter={[16, 16]}>
      {!isEmpty(customMetrics) && (
        <Col span={24}>
          <PageHeader data={PAGE_HEADERS.CUSTOM_METRICS} />
        </Col>
      )}
      {toPairs(customMetricsGraphData).map(([key, metric], i) => {
        const metricDetails = customMetrics?.find(
          (metric) => metric.name === key
        );
        const color = TOTAL_ENTITY_CHART_COLOR[i] ?? getRandomHexColor();

        return isUndefined(metricDetails) ? null : (
          <Col key={key} span={24}>
            <Card
              className="shadow-none global-border-radius custom-metric-card"
              data-testid={`${key}-custom-metrics`}
              extra={
                editPermission || deletePermission ? (
                  <Dropdown
                    menu={{
                      items,
                      onClick: (info) => handleMenuClick(info.key, key),
                    }}
                    placement="bottomLeft"
                    trigger={['click']}>
                    <Button
                      className="flex-center"
                      data-testid={`${key}-custom-metrics-menu`}
                      icon={<IconDropdown className="self-center" />}
                      size="small"
                    />
                  </Dropdown>
                ) : null
              }
              loading={isLoading}
              title={<Typography.Title level={5}>{key}</Typography.Title>}>
              <Row gutter={[16, 16]}>
                <Col span={4}>
                  <ProfilerLatestValue
                    information={[
                      {
                        latestValue: last(metric)?.[key] ?? '--',
                        title: '',
                        dataKey: key,
                        color,
                      },
                    ]}
                  />
                </Col>
                <Col span={20}>
                  {isEmpty(metric) ? (
                    <Row
                      align="middle"
                      className="h-full w-full"
                      justify="center">
                      <Col>
                        <ErrorPlaceHolder className="mt-0-important" />
                      </Col>
                    </Row>
                  ) : (
                    <ResponsiveContainer
                      className="custom-legend"
                      debounce={200}
                      id={`${key}-graph`}
                      minHeight={300}>
                      <LineChart
                        className="w-full"
                        data={metric}
                        margin={{ left: 16 }}>
                        <CartesianGrid stroke={GRAPH_BACKGROUND_COLOR} />
                        <XAxis
                          dataKey="formattedTimestamp"
                          padding={{ left: 16, right: 16 }}
                          tick={{ fontSize: 12 }}
                        />

                        <YAxis
                          domain={['min', 'max']}
                          padding={{ top: 16, bottom: 16 }}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(props) => axisTickFormatter(props)}
                          type="number"
                        />
                        <Tooltip
                          formatter={(value: number | string) =>
                            tooltipFormatter(value)
                          }
                        />

                        <Line
                          dataKey={key}
                          name={key}
                          stroke={color}
                          type="monotone"
                        />

                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Col>
              </Row>
            </Card>
          </Col>
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
    </Row>
  );
};

export default CustomMetricGraphs;
