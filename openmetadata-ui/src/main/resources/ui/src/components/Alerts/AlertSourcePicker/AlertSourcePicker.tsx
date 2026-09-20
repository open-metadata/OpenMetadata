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
import { Alert, Select, Space, Typography } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityIconSize } from '../../../utils/EntityIconUtils';
import { getSourceOptions } from '../../../utils/Alerts/AlertSelectionUtil';
import { getEntityNameLabel } from '../../../utils/EntityNameUtils';
import searchClassBase from '../../../utils/SearchClassBase';
import { AlertSourcePickerProps } from './AlertSourcePicker.interface';

/**
 * Several sources for one alert. A source that would break a rule is shown disabled with the
 * reason beside it, rather than failing on save. A selected source that can never produce a match
 * with what has been chosen so far gets a warning, and the alert can still be saved.
 */
function AlertSourcePicker({
  sources,
  value = [],
  onChange,
  loading,
  selection,
}: Readonly<AlertSourcePickerProps>) {
  const { t } = useTranslation();

  const sourceOptions = useMemo(
    () => getSourceOptions(sources, value, selection),
    [sources, value, selection]
  );

  const options = useMemo(
    () =>
      sourceOptions.map((option) => ({
        value: option.name,
        displayName: getEntityNameLabel(option.name),
        disabled: option.disabled,
        title: option.reason,
        label: (
          <div
            className="d-flex items-center gap-2"
            data-testid={`${option.name}-option`}>
            {searchClassBase.getEntityIconWithBg(
              option.name,
              EntityIconSize.Size14
            )}
            <Space direction="vertical" size={0}>
              <span>{getEntityNameLabel(option.name)}</span>
              {option.reason && (
                <Typography.Text
                  className="text-xs"
                  data-testid={`${option.name}-reason`}
                  type="secondary">
                  {option.reason}
                </Typography.Text>
              )}
            </Space>
          </div>
        ),
      })),
    [sourceOptions]
  );

  const warnings = useMemo(
    () => sourceOptions.filter((option) => option.warning),
    [sourceOptions]
  );

  return (
    <Space className="w-full" direction="vertical" size={8}>
      <Select
        className="w-full"
        data-testid="source-select"
        loading={loading}
        mode="multiple"
        optionLabelProp="displayName"
        options={options}
        placeholder={t('label.select-field', {
          field: t('label.data-asset-plural'),
        })}
        value={value}
        onChange={(chosen: string[]) => onChange?.(chosen, value)}
      />
      {warnings.map((option) => (
        <Alert
          showIcon
          data-testid={`${option.name}-warning`}
          key={option.name}
          message={`${getEntityNameLabel(option.name)}: ${option.warning}`}
          type="warning"
        />
      ))}
    </Space>
  );
}

export default AlertSourcePicker;
