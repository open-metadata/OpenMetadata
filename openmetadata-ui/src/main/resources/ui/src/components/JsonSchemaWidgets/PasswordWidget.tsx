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
import React, { FC } from 'react';
import '../../styles/components/form.less';

const PasswordWidget: FC<WidgetProps> = ({
  onFocus,
  onBlur,
  onChange,
  ...rest
}) => {
  return (
    <Input.Password
      autoComplete="off"
      autoFocus={rest.autofocus}
      className="custom-password-input"
      disabled={rest.disabled}
      id={rest.id}
      name={rest.name}
      placeholder={rest.placeholder}
      readOnly={rest.readonly}
      required={rest.required}
      value={rest.value}
      onBlur={() => onBlur(rest.id, rest.value)}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => onFocus(rest.id, rest.value)}
    />
  );
};

export default PasswordWidget;
