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
import { Button, List, Popover, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { startCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as IconRemoveColored } from '../../../assets/svg/ic-remove-colored.svg';
import {
  DE_ACTIVE_COLOR,
  NO_DATA_PLACEHOLDER,
} from '../../../constants/constants';
import {
  Metric,
  UnitOfMeasurement,
} from '../../../generated/entity/data/metric';
import { getCustomUnitsOfMeasurement } from '../../../rest/metricsAPI';
import { getSortedOptions } from '../../../utils/MetricEntityUtils/MetricUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import './unit-of-measurement-header.less';

interface UnitOfMeasurementInfoItemProps {
  label: string;
  hasPermission: boolean;
  metricDetails: Metric;
  onMetricUpdate: (updatedData: Metric, key?: keyof Metric) => Promise<void>;
}

const UnitOfMeasurementInfoItem: FC<UnitOfMeasurementInfoItemProps> = ({
  label,
  hasPermission,
  metricDetails,
  onMetricUpdate,
}) => {
  const { t } = useTranslation();
  const [popupVisible, setPopupVisible] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [customUnits, setCustomUnits] = useState<string[]>([]);

  const modiFiedLabel = label.toLowerCase().replace(/\s+/g, '-');

  const fetchCustomUnits = useCallback(async () => {
    try {
      const units = await getCustomUnitsOfMeasurement();
      setCustomUnits(units || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  useEffect(() => {
    fetchCustomUnits();
  }, []);

  const currentValue = useMemo(() => {
    if (metricDetails.unitOfMeasurement === UnitOfMeasurement.Other) {
      return metricDetails.customUnitOfMeasurement;
    }

    return metricDetails.unitOfMeasurement;
  }, [metricDetails.unitOfMeasurement, metricDetails.customUnitOfMeasurement]);

  const allOptions = useMemo(() => {
    // Standard unit options (excluding 'Other' as it's handled via custom units)
    const standardOptions = Object.values(UnitOfMeasurement)
      .filter((unit) => unit !== UnitOfMeasurement.Other)
      .map((unitOfMeasurement) => ({
        key: unitOfMeasurement,
        label: startCase(unitOfMeasurement.toLowerCase()),
        value: unitOfMeasurement,
      }));

    // Custom unit options
    const customOptions = customUnits.map((unit) => ({
      key: unit,
      label: unit,
      value: unit,
    }));

    return getSortedOptions(
      [...standardOptions, ...customOptions],
      currentValue,
      'unitOfMeasurement'
    );
  }, [customUnits, currentValue]);

  const handleUpdate = async (value: string | undefined) => {
    try {
      setIsUpdating(true);
      const updatedMetricDetails: Metric = {
        ...metricDetails,
      };

      if (!value) {
        // Remove unit of measurement
        updatedMetricDetails.unitOfMeasurement = undefined;
        updatedMetricDetails.customUnitOfMeasurement = undefined;
      } else if (customUnits.includes(value)) {
        // Custom unit selected
        updatedMetricDetails.unitOfMeasurement = UnitOfMeasurement.Other;
        updatedMetricDetails.customUnitOfMeasurement = value;
      } else {
        // Standard unit selected
        updatedMetricDetails.unitOfMeasurement = value as UnitOfMeasurement;
        updatedMetricDetails.customUnitOfMeasurement = undefined;
      }

      await onMetricUpdate(updatedMetricDetails, 'unitOfMeasurement');
      setPopupVisible(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const list = (
    <List
      className="unit-of-measurement-header"
      dataSource={allOptions}
      itemLayout="vertical"
      renderItem={(item) => {
        const isActive = currentValue === item.value;

        return (
          <List.Item
            className={classNames('selectable-list-item', 'cursor-pointer', {
              active: isActive,
            })}
            extra={
              isActive && (
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
            }}>
            <Typography.Text>{item.label}</Typography.Text>
          </List.Item>
        );
      }}
      size="small"
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
            {currentValue ?? NO_DATA_PLACEHOLDER}
          </div>
        </Typography.Text>
      </div>
    </Space>
  );
};

export default UnitOfMeasurementInfoItem;
