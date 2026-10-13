/*
 *  Copyright 2026 Collate.
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
import { FC } from 'react';
import {
  fqnsToGlossaryTags,
  glossaryTagsToFqns,
} from '../../components/common/GlossaryTermPicker/GlossaryTagSuggestionUtils';
import GlossaryTermPicker from '../../components/common/GlossaryTermPicker/GlossaryTermPicker';

interface GlossaryTermQueryWidgetProps {
  value: string | string[] | null | undefined;
  multiple: boolean;
  placeholder?: string;
  readonly?: boolean;
  onChange: (value: string | string[] | undefined) => void;
}

// Swaps only the control: RAQB still gets the same FQN, so serialisation holds.
const GlossaryTermQueryWidget: FC<GlossaryTermQueryWidgetProps> = ({
  value,
  multiple,
  placeholder,
  readonly,
  onChange,
}) => {
  const toFqnList = (): string[] => {
    if (Array.isArray(value)) {
      return value.map(String);
    }

    return value ? [value] : [];
  };
  const fqns = toFqnList();

  return (
    <GlossaryTermPicker
      data-testid="glossary-term-query-widget"
      disabled={readonly}
      multiple={multiple}
      placeholder={placeholder}
      value={fqnsToGlossaryTags(fqns)}
      onChange={(terms) => {
        const selected = glossaryTagsToFqns(terms);

        onChange(multiple ? selected : selected[0]);
      }}
    />
  );
};

export default GlossaryTermQueryWidget;
