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
import { Input } from '@openmetadata/ui-core-components';
import type { NumberWidgetProps } from '@react-awesome-query-builder/ui';
import { useEffect, useRef, useState, type FC } from 'react';

const OMNumberWidget: FC<NumberWidgetProps> = ({
  value,
  setValue,
  placeholder,
  readonly,
}) => {
  const externalStr =
    value !== null && value !== undefined ? String(value) : '';
  const [localValue, setLocalValue] = useState(externalStr);
  // Prevent external value sync from overwriting the user's in-progress input
  // (e.g. typing "1." would round to 1, which would then reset the display to
  // "1" and make it impossible to type a decimal).
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalValue(externalStr);
    }
  }, [externalStr]);

  return (
    <Input
      inputDataTestId="qb-number-input"
      isDisabled={readonly}
      placeholder={placeholder}
      size="sm"
      type="number"
      value={localValue}
      onBlur={() => {
        isFocusedRef.current = false;
      }}
      onChange={(v: string) => {
        setLocalValue(v);
        if (v === '') {
          setValue(null);
        } else {
          const num = Number(v);
          if (!isNaN(num)) {
            setValue(num);
          }
        }
      }}
      onFocus={() => {
        isFocusedRef.current = true;
      }}
    />
  );
};

export default OMNumberWidget;
