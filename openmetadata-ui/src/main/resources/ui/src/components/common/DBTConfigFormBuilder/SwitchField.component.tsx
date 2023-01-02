/*
 *  Copyright 2022 Collate.
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

import { Space, Switch } from 'antd';
import React from 'react';
import { Field } from '../../Field/Field';

interface Props {
  dbtUpdateDescriptions: boolean;
  id: string;
  handleUpdateDescriptions: (value: boolean) => void;
}

function SwitchField({
  dbtUpdateDescriptions,
  id,
  handleUpdateDescriptions,
}: Props) {
  return (
    <Field>
      <Space align="end" className="m-b-xs">
        <label
          className="tw-block tw-form-label m-b-0"
          data-testid={id}
          htmlFor={id}>
          Update Description
        </label>
        <Switch
          checked={dbtUpdateDescriptions}
          id={id}
          onChange={handleUpdateDescriptions}
        />
      </Space>
      <p
        className="tw-text-grey-muted tw-mt-1 tw-mb-2 tw-text-xs"
        data-testid="switch-description">
        Optional configuration to update the description from dbt or not
      </p>
    </Field>
  );
}

export default SwitchField;
