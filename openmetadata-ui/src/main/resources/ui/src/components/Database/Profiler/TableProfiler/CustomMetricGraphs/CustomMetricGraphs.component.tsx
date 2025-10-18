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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  Box,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  useTheme,
} from '@mui/material';
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
  const theme = useTheme();
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
  const [anchorEl, setAnchorEl] = useState<Record<string, HTMLElement | null>>(
    {}
  );

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
    setAnchorEl((prev) => ({ ...prev, [metricName]: null }));
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

  const handleMenuOpen = (
    event: React.MouseEvent<HTMLElement>,
    metricName: string
  ) => {
    setAnchorEl((prev) => ({ ...prev, [metricName]: event.currentTarget }));
  };

  const handleMenuClose = (metricName: string) => {
    setAnchorEl((prev) => ({ ...prev, [metricName]: null }));
  };

  return (
    <Stack data-testid="custom-metric-graph-container" spacing="30px">
      {toPairs(customMetricsGraphData).map(([key, metric]) => {
        const metricDetails = customMetrics?.find(
          (metric) => metric.name === key
        );

        return isUndefined(metricDetails) ? null : (
          <Box key={key}>
            <ProfilerStateWrapper
              data-testid={`${key}-custom-metrics`}
              isLoading={isLoading}
              profilerLatestValueProps={{
                information: [
                  {
                    latestValue: last(metric)?.[key] ?? '--',
                    title: t('label.count'),
                    dataKey: key,
                    color: theme.palette.allShades.blue[500],
                  },
                ],
                extra:
                  editPermission || deletePermission ? (
                    <>
                      <IconButton
                        data-testid={`${key}-custom-metrics-menu`}
                        size="small"
                        sx={{
                          color: theme.palette.grey[800],
                        }}
                        onClick={(e) => handleMenuOpen(e, key)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                      <Menu
                        anchorEl={anchorEl[key]}
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'right',
                        }}
                        open={Boolean(anchorEl[key])}
                        sx={{
                          '.MuiPaper-root': {
                            width: 'max-content',
                          },
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'right',
                        }}
                        onClose={() => handleMenuClose(key)}>
                        {items.map((item) => (
                          <MenuItem
                            disabled={item.disabled}
                            key={item.key}
                            onClick={() => handleMenuClick(item.key, key)}>
                            {item.label}
                          </MenuItem>
                        ))}
                      </Menu>
                    </>
                  ) : undefined,
              }}
              title={key}>
              <Box>
                {isEmpty(metric) ? (
                  <Grid
                    alignItems="middle"
                    className="h-full w-full"
                    display="flex"
                    justifyContent="center">
                    <ErrorPlaceHolder className="mt-0-important" />
                  </Grid>
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
                          stroke: theme.palette.grey[200],
                          strokeDasharray: '3 3',
                        }}
                      />

                      <Line
                        dataKey={key}
                        name={key}
                        stroke={theme.palette.allShades.blue[500]}
                        type="monotone"
                      />
                      <Area
                        dataKey={key}
                        fill={theme.palette.allShades.blue[50]}
                        name={key}
                        stroke={theme.palette.allShades.blue[500]}
                        type="monotone"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </ProfilerStateWrapper>
          </Box>
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
    </Stack>
  );
};

export default CustomMetricGraphs;
