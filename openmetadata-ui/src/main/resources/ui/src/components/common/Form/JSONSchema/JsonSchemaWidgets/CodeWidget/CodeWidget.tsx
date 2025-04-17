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
import { WidgetProps } from '@rjsf/utils';
import { useCallback } from 'react';
import SchemaEditor from '../../../../../Database/SchemaEditor/SchemaEditor';
import './code-widget.less';

const CodeWidget = ({
  value,
  onChange,
  disabled,
  schema,
  onFocus,
  ...props
}: WidgetProps) => {
  const onFocusHandler = useCallback(() => {
    onFocus?.(props.id, props.value);
  }, [onFocus, props.id, props.value]);

  return (
    <SchemaEditor
      className="code-widget"
      mode={schema.mode}
      readOnly={disabled}
      showCopyButton={false}
      value={value || ''}
      onChange={onChange}
      onFocus={onFocusHandler}
    />
  );
};

export default CodeWidget;
