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
import { Input } from '@openmetadata/ui-core-components';
import type { NumberWidgetProps } from '@react-awesome-query-builder/ui';
import type { FC } from 'react';

const OMNumberWidget: FC<NumberWidgetProps> = ({
  value,
  setValue,
  placeholder,
  readonly,
}) => (
  <Input
    inputDataTestId="qb-number-input"
    isDisabled={readonly}
    placeholder={placeholder}
    size="sm"
    type="number"
    value={value !== null && value !== undefined ? String(value) : ''}
    onChange={(v: string) =>
      setValue(v === '' ? null : (Number(v) as number & null))
    }
  />
);

export default OMNumberWidget;
