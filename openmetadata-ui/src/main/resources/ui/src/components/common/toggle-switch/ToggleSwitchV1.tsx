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

import { Switch } from 'antd';
import React from 'react';

export interface ToggleSwitchV1Props {
  checked: boolean;
  handleCheck: () => void;
  testId?: string;
  id?: string;
}

const ToggleSwitchV1 = ({
  checked,
  handleCheck,
  testId,
  id,
}: ToggleSwitchV1Props) => {
  return (
    <Switch
      checked={checked}
      data-testid={testId ? `toggle-button-${testId}` : 'toggle-button'}
      id={id}
      onChange={handleCheck}
    />
  );
};

export default ToggleSwitchV1;
