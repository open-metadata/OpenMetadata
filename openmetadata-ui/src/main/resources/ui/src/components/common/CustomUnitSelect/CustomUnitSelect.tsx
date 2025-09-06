/*
 *  Copyright 2025 Collate.
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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Input, Select } from 'antd';
import { AxiosError } from 'axios';
import { startCase } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UnitOfMeasurement } from '../../../generated/entity/data/metric';
import { getCustomUnitsOfMeasurement } from '../../../rest/metricsAPI';
import { showErrorToast } from '../../../utils/ToastUtils';

interface CustomUnitSelectProps {
  value?: string;
  customValue?: string;
  onChange?: (
    unitOfMeasurement: string,
    customUnitOfMeasurement?: string
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  showSearch?: boolean;
  dataTestId?: string;
}

const CustomUnitSelect: FC<CustomUnitSelectProps> = ({
  value,
  customValue,
  onChange,
  placeholder,
  disabled = false,
  showSearch = true,
  dataTestId = 'unit-of-measurement-select',
}) => {
  const { t } = useTranslation();
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const [userAddedUnits, setUserAddedUnits] = useState<string[]>([]);
  const [newCustomUnit, setNewCustomUnit] = useState('');
  const [loading, setLoading] = useState(false);

  // Memoized computed values
  const { allCustomUnits, allOptions } = useMemo(() => {
    // Combine custom units with deduplication
    const combinedCustomUnits = [
      ...new Set([...customUnits, ...userAddedUnits]),
    ];

    // Standard unit options
    const standardOptions = Object.values(UnitOfMeasurement)
      .filter((unit) => unit !== UnitOfMeasurement.Other)
      .map((unit) => ({
        label: startCase(unit.toLowerCase()),
        value: unit,
      }));

    // Custom options from combined units
    const customOptions = combinedCustomUnits.map((unit) => ({
      label: unit,
      value: unit,
    }));

    // Combined options - standard units first, then custom units
    const combinedOptions = [...standardOptions, ...customOptions];

    return {
      allCustomUnits: combinedCustomUnits,
      allOptions: combinedOptions,
    };
  }, [customUnits, userAddedUnits]);

  const fetchCustomUnits = useCallback(async () => {
    try {
      setLoading(true);
      const units = await getCustomUnitsOfMeasurement();
      setCustomUnits(units || []);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch custom units from backend on component mount
  useEffect(() => {
    fetchCustomUnits();
  }, []);

  // Initialize with current custom value if it exists
  useEffect(() => {
    if (customValue && !allCustomUnits.includes(customValue)) {
      setUserAddedUnits([customValue]);
    }
  }, [customValue, allCustomUnits]);

  const handleAddCustomUnit = () => {
    const trimmedUnit = newCustomUnit.trim();
    if (trimmedUnit) {
      // Check if it already exists in either list
      if (!allCustomUnits.includes(trimmedUnit)) {
        setUserAddedUnits([...userAddedUnits, trimmedUnit]);
      }
      // Select the newly added custom unit
      onChange?.(UnitOfMeasurement.Other, trimmedUnit);
      setNewCustomUnit('');
    }
  };

  const handleChange = (selectedValue: string) => {
    // Check if it's a custom unit (from backend or user-added)
    const isCustomUnit = allCustomUnits.includes(selectedValue);

    if (isCustomUnit) {
      // Custom unit selected - set unitOfMeasurement to OTHER
      onChange?.(UnitOfMeasurement.Other, selectedValue);
    } else {
      // Standard unit selected - clear customUnitOfMeasurement
      onChange?.(selectedValue, undefined);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCustomUnit(e.target.value);
  };

  // Determine display value
  const displayValue = value === UnitOfMeasurement.Other ? customValue : value;

  return (
    <Select
      data-testid={dataTestId}
      disabled={disabled}
      dropdownRender={(menu) => (
        <>
          {menu}
          <Divider className="m-y-sm m-x-0" />
          <div className="p-x-sm gap-2 d-flex items-center">
            <Input
              placeholder={t('label.enter-custom-unit-of-measurement')}
              value={newCustomUnit}
              onChange={handleNameChange}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  handleAddCustomUnit();
                }
              }}
            />
            <Button
              icon={<PlusOutlined />}
              type="text"
              onClick={handleAddCustomUnit}>
              {t('label.add')}
            </Button>
          </div>
        </>
      )}
      loading={loading}
      options={allOptions}
      placeholder={placeholder}
      showSearch={showSearch}
      value={displayValue}
      onChange={handleChange}
    />
  );
};

export default CustomUnitSelect;
