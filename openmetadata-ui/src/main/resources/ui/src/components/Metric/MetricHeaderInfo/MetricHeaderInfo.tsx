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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Button, Divider, List, Space, Typography } from 'antd';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconRemoveColored } from '../../../assets/svg/ic-remove-colored.svg';
import {
    DE_ACTIVE_COLOR,
    NO_DATA_PLACEHOLDER
} from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import {
    Metric,
    MetricGranularity,
    MetricType,
    UnitOfMeasurement
} from '../../../generated/entity/data/metric';
import { getSortedOptions } from '../../../utils/MetricEntityUtils/MetricUtils';
import { Popover, Tooltip } from '../../common/AntdCompat';
import './metric-header-info.less';
;

interface MetricInfoItemOption {
  label: string;
  value: string;
  key: string;
}

interface MetricHeaderInfoProps {
  metricPermissions: OperationPermission;
  metricDetails: Metric;
  onUpdateMetricDetails: (
    updatedData: Metric,
    key: keyof Metric
  ) => Promise<void>;
}

interface MetricInfoItemProps {
  label: string;
  value: string | undefined;
  hasPermission: boolean;
  options: MetricInfoItemOption[];
  valueKey: keyof Metric;
  metricDetails: Metric;
  onUpdateMetricDetails: MetricHeaderInfoProps['onUpdateMetricDetails'];
}

const MetricInfoItem: FC<MetricInfoItemProps> = ({
  label,
  value,
  hasPermission,
  options,
  onUpdateMetricDetails,
  valueKey,
  metricDetails,
}) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const modiFiedLabel = label.toLowerCase().replace(/\s+/g, '-');

  const sortedOptions = useMemo(
    () => getSortedOptions(options, value, valueKey),
    [options, value, valueKey]
  );

  const handleUpdate = async (value: string | undefined) => {
    try {
      setIsUpdating(true);
      const updatedMetricDetails = {
        ...metricDetails,
        [valueKey]: value,
      };

      await onUpdateMetricDetails(updatedMetricDetails, valueKey);
    } catch (error) {
      //
    } finally {
      setIsUpdating(false);
    }
  };

  const list = (
    <List
      dataSource={sortedOptions}
      itemLayout="vertical"
      renderItem={(item) => (
        <List.Item
          className={classNames('selectable-list-item', 'cursor-pointer', {
            active: value === item.value,
          })}
          extra={
            value === item.value && (
              <Tooltip
                title={t('label.remove-entity', {
                  entity: label,
                })}>
                <Icon
                  className="align-middle"
                  component={IconRemoveColored}
                  data-testid={`remove-${modiFiedLabel}-button`}
                  style={{ fontSize: '16px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpdate(undefined);
                    setPopupVisible(false);
                  }}
                />
              </Tooltip>
            )
          }
          key={item.key}
          title={item.label}
          onClick={(e) => {
            e.stopPropagation();
            handleUpdate(item.value);
            setPopupVisible(false);
          }}>
          <Typography.Text>{item.label}</Typography.Text>
        </List.Item>
      )}
      size="small"
      style={{
        maxHeight: '250px',
        overflowY: 'auto',
      }}
    />
  );

  return (
    <Space
      className="d-flex metric-header-info-container align-start"
      data-testid={modiFiedLabel}>
      <div className="d-flex extra-info-container align-start ">
        <Typography.Text
          className="whitespace-nowrap text-sm d-flex flex-col gap-2"
          data-testid={modiFiedLabel}>
          <div className="d-flex items-center gap-1">
            <span className="extra-info-label-heading">{label}</span>
            {hasPermission && !metricDetails.deleted && (
              <Popover
                destroyTooltipOnHide
                content={list}
                open={popupVisible}
                overlayClassName="metric-header-info-popover"
                placement="bottomRight"
                showArrow={false}
                trigger="click"
                onOpenChange={setPopupVisible}>
                <Tooltip
                  title={t('label.edit-entity', {
                    entity: label,
                  })}>
                  <Button
                    className="flex-center edit-metrics p-0"
                    data-testid={`edit-${modiFiedLabel}-button`}
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="12px" />}
                    loading={isUpdating}
                    size="small"
                    type="text"
                  />
                </Tooltip>
              </Popover>
            )}
          </div>
          <div className={classNames('font-medium extra-info-value')}>
            {value ?? NO_DATA_PLACEHOLDER}
          </div>
        </Typography.Text>
      </div>
    </Space>
  );
};

const MetricHeaderInfo: FC<MetricHeaderInfoProps> = ({
  metricDetails,
  metricPermissions,
  onUpdateMetricDetails,
}) => {
  const { t } = useTranslation();
  const hasPermission = Boolean(metricPermissions.EditAll);

  return (
    <>
      <Divider className="self-center vertical-divider" type="vertical" />
      <MetricInfoItem
        hasPermission={hasPermission}
        label={t('label.metric-type')}
        metricDetails={metricDetails}
        options={Object.values(MetricType).map((metricType) => ({
          key: metricType,
          label: startCase(metricType.toLowerCase()),
          value: metricType,
        }))}
        value={metricDetails.metricType}
        valueKey="metricType"
        onUpdateMetricDetails={onUpdateMetricDetails}
      />
      <Divider className="self-center vertical-divider" type="vertical" />

      <MetricInfoItem
        hasPermission={hasPermission}
        label={t('label.unit-of-measurement')}
        metricDetails={metricDetails}
        options={Object.values(UnitOfMeasurement).map((unitOfMeasurement) => ({
          key: unitOfMeasurement,
          label: startCase(unitOfMeasurement.toLowerCase()),
          value: unitOfMeasurement,
        }))}
        value={metricDetails.unitOfMeasurement}
        valueKey="unitOfMeasurement"
        onUpdateMetricDetails={onUpdateMetricDetails}
      />
      <Divider className="self-center vertical-divider" type="vertical" />

      <MetricInfoItem
        hasPermission={hasPermission}
        label={t('label.granularity')}
        metricDetails={metricDetails}
        options={Object.values(MetricGranularity).map((granularity) => ({
          key: granularity,
          label: startCase(granularity.toLowerCase()),
          value: granularity,
        }))}
        value={metricDetails.granularity}
        valueKey="granularity"
        onUpdateMetricDetails={onUpdateMetricDetails}
      />
    </>
  );
};

export default MetricHeaderInfo;
