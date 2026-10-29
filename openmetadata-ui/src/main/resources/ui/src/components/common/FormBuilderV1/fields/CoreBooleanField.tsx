/*
 *  Copyright 2025 Collate.
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
import { ADDITIONAL_PROPERTY_FLAG, FieldProps } from '@rjsf/utils';
import { getFormDisplayLabel } from '../formBuilderV1LabelUtils';
import { getWidgetAriaProps } from '../widgets/coreWidgetUtils';

const CoreBooleanField = (props: FieldProps) => {
  return (
    <Toggle
      {...getWidgetAriaProps({ label: props.name, schema: props.schema })}
      id={props.idSchema.$id}
      isDisabled={props.disabled || props.readonly}
      isSelected={props.formData ?? false}
      label={
        ADDITIONAL_PROPERTY_FLAG in props.schema
          ? undefined
          : props.schema.title ?? getFormDisplayLabel(props.name)
      }
      onChange={(value) => {
        props.formContext?.handleFocus?.(props.idSchema.$id);
        props.onChange(value);
      }}
    />
  );
};

export default CoreBooleanField;
