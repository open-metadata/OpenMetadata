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

import { InfoCircleOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import React from 'react';
import { GRAYED_OUT_COLOR } from '../../constants/constants';
import { FormItemLabelProps } from './Form.interface';

const FormItemLabel = ({
  label,
  helperText,
  align,
  placement = 'top',
}: FormItemLabelProps) => {
  return (
    <>
      <span data-testid="form-item-label">{label}</span>
      {helperText && (
        <Tooltip align={align} placement={placement} title={helperText}>
          <InfoCircleOutlined
            className="m-l-xs"
            data-testid="helper-icon"
            style={{ color: GRAYED_OUT_COLOR }}
          />
        </Tooltip>
      )}
    </>
  );
};

export default FormItemLabel;
