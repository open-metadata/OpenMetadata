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
import { Typography } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';

interface MetricCustomPropertyValueProps {
  value: unknown;
}

const MetricCustomPropertyValue = ({
  value,
}: MetricCustomPropertyValueProps) => {
  const { t } = useTranslation();

  if (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return (
      <Typography className="tw:text-tertiary" size="text-sm">
        {t('label.empty-dash')}
      </Typography>
    );
  }

  if (typeof value === 'boolean') {
    return (
      <Typography size="text-sm">
        {value ? t('label.true') : t('label.false')}
      </Typography>
    );
  }

  if (typeof value === 'number') {
    return <Typography size="text-sm">{value.toLocaleString()}</Typography>;
  }

  if (typeof value === 'string') {
    return (
      <Typography className="tw:break-words" size="text-sm">
        {value}
      </Typography>
    );
  }

  return (
    <pre className="tw:max-h-48 tw:w-full tw:overflow-auto tw:whitespace-pre-wrap tw:break-words tw:rounded-md tw:bg-secondary tw:p-2 tw:text-xs tw:text-secondary">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
};

export default MetricCustomPropertyValue;
