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
import { Toggle } from '@openmetadata/ui-core-components';
import { FieldProps } from '@rjsf/utils';
import { startCase } from 'lodash';

const BooleanFieldTemplate = (props: FieldProps) => {
  const title = props.schema.title ?? startCase(props.name);

  return (
    <div className="design-boolean-field tw:flex tw:items-start tw:gap-3 tw:rounded-xl tw:py-1">
      <Toggle
        className="tw:mt-0.5 tw:flex-shrink-0"
        id={props.idSchema.$id}
        isSelected={props.formData ?? false}
        size="sm"
        onChange={(value) => {
          props.onChange(value);
          props.formContext?.handleFocus?.(props.idSchema.$id);
        }}
      />
      <div className="tw:min-w-0 tw:flex-1">
        <label
          className="tw:block tw:cursor-pointer tw:font-medium tw:leading-5 tw:text-primary"
          htmlFor={props.idSchema.$id}>
          {title}
        </label>
        {props.schema.description && (
          <div className="tw:mt-1 tw:text-xs tw:text-tertiary">
            {props.schema.description}
          </div>
        )}
      </div>
    </div>
  );
};

export default BooleanFieldTemplate;
