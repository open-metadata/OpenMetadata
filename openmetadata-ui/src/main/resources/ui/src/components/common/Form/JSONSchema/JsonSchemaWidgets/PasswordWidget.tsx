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
import { WidgetProps } from '@rjsf/utils';
import { Input } from 'antd';
import { FC, useMemo } from 'react';
import { ALL_ASTERISKS_REGEX } from '../../../../../constants/regex.constants';
import FileUploadWidget from './FileUploadWidget';

const PasswordWidget: FC<WidgetProps> = (props) => {
  const passwordWidgetValue = useMemo(() => {
    if (ALL_ASTERISKS_REGEX.test(props.value)) {
      return undefined; // Do not show the password if it is masked
    } else {
      return props.value;
    }
  }, [props.value]);

  if (props.schema.uiFieldType === 'file') {
    return <FileUploadWidget {...props} />;
  }

  const { onFocus, onBlur, onChange, ...rest } = props;

  return (
    <Input.Password
      autoComplete="off"
      autoFocus={rest.autofocus}
      data-testid="password-input-widget"
      disabled={rest.disabled}
      id={rest.id}
      name={rest.name}
      placeholder={rest.placeholder}
      readOnly={rest.readonly}
      required={rest.required}
      value={passwordWidgetValue}
      onBlur={() => onBlur(rest.id, rest.value)}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => onFocus(rest.id, rest.value)}
    />
  );
};

export default PasswordWidget;
