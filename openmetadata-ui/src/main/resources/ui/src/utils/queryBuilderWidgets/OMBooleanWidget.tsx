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
import { Toggle } from '@openmetadata/ui-core-components';
import type { BooleanWidgetProps } from '@react-awesome-query-builder/ui';
import type { FC } from 'react';

const OMBooleanWidget: FC<BooleanWidgetProps> = ({
  value,
  setValue,
  readonly,
}) => (
  <Toggle
    isDisabled={readonly}
    isSelected={value === true}
    onChange={(checked: boolean) => setValue(checked)}
  />
);

export default OMBooleanWidget;
