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
import { CloseOutlined } from '@ant-design/icons';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';

export const TagRenderer = (props: CustomTagProps) => {
  const { label, closable, onClose } = props;
  const displayLabel =
    typeof label === 'string' && label.length > 12
      ? `${label.substring(0, 12)}...`
      : label;

  return (
    <span className="ant-select-selection-item" title={(label as string) ?? ''}>
      {displayLabel}
      {closable && (
        <button className="selected-chip-tag-remove" onClick={onClose}>
          <CloseOutlined />
        </button>
      )}
    </span>
  );
};
