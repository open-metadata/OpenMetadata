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
import {
  TreeSelect,
  TreeSelectNode,
  TreeSelectProps,
} from '@openmetadata/ui-core-components';
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TagSource } from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import Fqn from '../../../utils/Fqn';
import { useGlossaryTreeData } from './useGlossaryTreeData';

// Straight from the core component so they never drift; the rest is fixed here.
type InheritedTreeSelectProps = Pick<
  TreeSelectProps<TagLabel>,
  | 'multiple'
  | 'commitMode'
  | 'isOpen'
  | 'onOpenChange'
  | 'renderTrigger'
  | 'label'
  | 'placeholder'
  | 'required'
  | 'data-testid'
>;

export interface GlossaryTermPickerProps extends InheritedTreeSelectProps {
  // Non-glossary sources are ignored; the caller owns merging them back.
  value?: TagLabel[];
  onChange?: (terms: TagLabel[]) => void;
}

// The one glossary-term surface: core `TreeSelect` plus a `TagLabel` contract.
const GlossaryTermPicker: FC<GlossaryTermPickerProps> = ({
  value = [],
  onChange,
  multiple = true,
  commitMode,
  isOpen,
  onOpenChange,
  renderTrigger,
  label,
  placeholder,
  required = false,
  'data-testid': dataTestId,
}) => {
  const { t } = useTranslation();
  const fetchData = useGlossaryTreeData();

  const selectedValue = useMemo(
    () =>
      value
        .filter((tag) => tag.source === TagSource.Glossary)
        .map(
          (tag): TreeSelectNode<TagLabel> => ({
            id: tag.tagFQN,
            label: tag.displayName || tag.name || tag.tagFQN,
            value: tag.tagFQN,
            // Glossary nodes are keyed by name, which is the term FQN's root.
            parentId: Fqn.split(tag.tagFQN)[0],
            data: tag,
          })
        ),
    [value]
  );

  const handleChange = useCallback(
    (
      selectedNodes:
        | TreeSelectNode<TagLabel>[]
        | TreeSelectNode<TagLabel>
        | null
    ) => {
      const nodes = selectedNodes
        ? [selectedNodes].flat().filter((node) => node.allowSelection !== false)
        : [];

      // An applied label carries server fields the listing never returns.
      const applied = new Map(value.map((tag) => [tag.tagFQN, tag]));

      onChange?.(
        nodes
          .map((node) => applied.get(node.value) ?? node.data)
          .filter((tag): tag is TagLabel => Boolean(tag))
      );
    },
    [onChange, value]
  );

  // The server already filtered; filtering again would hide matching glossaries.
  const keepAllNodes = useCallback(() => true, []);

  return (
    <TreeSelect
      cascadeSelection
      lazyLoad
      searchable
      commitMode={commitMode}
      data-testid={dataTestId}
      fetchData={fetchData}
      filterNode={keepAllNodes}
      isOpen={isOpen}
      label={label}
      multiple={multiple}
      placeholder={
        placeholder ??
        t('label.select-field', { field: t('label.glossary-term-plural') })
      }
      renderTrigger={renderTrigger}
      required={required}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.glossary-term-plural'),
      })}
      value={selectedValue}
      onChange={handleChange}
      onOpenChange={onOpenChange}
    />
  );
};

export default GlossaryTermPicker;
