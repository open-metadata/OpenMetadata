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
  TreeSelectDataResponse,
  TreeSelectNode,
  TreeSelectProps,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { FC, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { PAGE_SIZE_EXTRA_LARGE } from '../../../constants/constants';
import { TagSource } from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import Fqn from '../../../utils/Fqn';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  GlossaryPickerValue,
  pruneNodes,
  toTagLabel,
} from './GlossaryTagSuggestionUtils';
import { useGlossaryTreeData } from './useGlossaryTreeData';

// Straight from the core component so they never drift; the rest is fixed here.
type InheritedTreeSelectProps = Pick<
  TreeSelectProps<GlossaryPickerValue>,
  | 'multiple'
  | 'commitMode'
  | 'isOpen'
  | 'onOpenChange'
  | 'renderTrigger'
  | 'triggerVariant'
  | 'offset'
  | 'bordered'
  | 'label'
  | 'placeholder'
  | 'required'
  | 'disabled'
  | 'autoFocus'
  | 'className'
  | 'data-testid'
>;

export interface GlossaryTermPickerProps extends InheritedTreeSelectProps {
  // Non-glossary sources are ignored; the caller owns merging them back.
  value?: TagLabel[];
  // `terms` is PATCH-safe; `nodes` carries the source entities.
  onChange?: (terms: TagLabel[], nodes: GlossaryPickerValue[]) => void;
  // FQNs to hide, e.g. the term a relation is being added to.
  excludeFqns?: string[];
  // Lets a glossary itself be the value, for pickers that choose a parent.
  selectGlossaries?: boolean;
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
  triggerVariant,
  offset,
  bordered,
  label,
  placeholder,
  required = false,
  disabled = false,
  autoFocus = false,
  className,
  'data-testid': dataTestId,
  excludeFqns,
  selectGlossaries = false,
}) => {
  const { t } = useTranslation();
  const fetchGlossaryTree = useGlossaryTreeData(selectGlossaries);

  // Keyed by contents: callers pass an inline array, so a per-identity memo
  // would hand back a new Set every render and reset the tally below.
  const excludeKey = (excludeFqns ?? []).join('\u0000');
  const excluded = useMemo(
    () => new Set(excludeKey ? excludeKey.split('\u0000') : []),
    [excludeKey]
  );

  // Running per branch, because the tree keeps only the newest page's total.
  const prunedPerBranch = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    prunedPerBranch.current = new Map();
  }, [excluded]);

  // Pruned on fetch, not via `filterNode`, which the tree applies to searches only.
  const fetchData = useCallback(
    async (
      params: Parameters<typeof fetchGlossaryTree>[0]
    ): Promise<TreeSelectDataResponse<GlossaryPickerValue>> => {
      const response = await fetchGlossaryTree(params);

      if (excluded.size === 0) {
        return response;
      }

      const nodes = pruneNodes(response.nodes, excluded);
      if (!params.parentId || response.total === undefined) {
        return { ...response, nodes };
      }

      // `total` counts what the server holds; the row counts what survives.
      const pruned =
        (params.after ? prunedPerBranch.current.get(params.parentId) ?? 0 : 0) +
        (response.nodes.length - nodes.length);
      prunedPerBranch.current.set(params.parentId, pruned);

      return { ...response, nodes, total: response.total - pruned };
    },
    [fetchGlossaryTree, excluded]
  );

  const selectedValue = useMemo(
    () =>
      value
        .filter((tag) => tag.source === TagSource.Glossary)
        .map(
          (tag): TreeSelectNode<GlossaryPickerValue> => ({
            id: tag.tagFQN,
            label: tag.displayName || tag.name || tag.tagFQN,
            value: tag.tagFQN,
            // Glossary nodes are keyed by the raw name, so a quoted one never matches.
            parentId: Fqn.unquoteName(Fqn.split(tag.tagFQN)[0]),
            data: tag,
          })
        ),
    [value]
  );

  const handleChange = useCallback(
    (
      selectedNodes:
        | TreeSelectNode<GlossaryPickerValue>[]
        | TreeSelectNode<GlossaryPickerValue>
        | null
    ) => {
      const nodes = selectedNodes
        ? [selectedNodes].flat().filter((node) => node.allowSelection !== false)
        : [];

      // An applied label carries server fields the listing never returns.
      const applied = new Map<string, GlossaryPickerValue>(
        value.map((tag) => [tag.tagFQN, tag])
      );

      const selected = nodes.reduce<GlossaryPickerValue[]>((acc, node) => {
        const tag = applied.get(node.value) ?? node.data;
        if (tag && (selectGlossaries || !tag.isGlossaryRoot)) {
          acc.push(tag);
        }

        return acc;
      }, []);

      onChange?.(selected.map(toTagLabel), selected);
    },
    [onChange, value, selectGlossaries]
  );

  // The server already filtered; filtering again would hide matching glossaries.
  const keepAllNodes = useCallback(() => true, []);

  const handleFetchError = useCallback(
    (error: unknown) => showErrorToast(error as AxiosError),
    []
  );

  return (
    // No cascade: a term is applied on its own; a parent is a container.
    <TreeSelect
      lazyLoad
      searchable
      // eslint-disable-next-line jsx-a11y/no-autofocus -- opt-in, for a picker opened without a click
      autoFocus={autoFocus}
      bordered={bordered}
      className={className}
      commitMode={commitMode}
      data-testid={dataTestId}
      disabled={disabled}
      // A glossary with no terms, rather than the generic "no data".
      emptyBranchMessage={t('label.no-entity-added', {
        entity: t('label.term-plural'),
      })}
      fetchData={fetchData}
      filterNode={keepAllNodes}
      isOpen={isOpen}
      label={label}
      multiple={multiple}
      offset={offset}
      // One page per branch; the rest arrives behind "Show N more".
      pageSize={PAGE_SIZE_EXTRA_LARGE}
      placeholder={
        placeholder ??
        t('label.select-field', { field: t('label.glossary-term-plural') })
      }
      // Stable test hook: the popover's testid varies per instance, this does not.
      popoverClassName="glossary-term-picker-popover"
      renderTrigger={renderTrigger}
      required={required}
      searchPlaceholder={t('label.search-entity', {
        entity: t('label.glossary-term-plural'),
      })}
      triggerVariant={triggerVariant}
      value={selectedValue}
      onChange={handleChange}
      // Owned here, so a failed page reports the API error, not axios's string.
      onFetchError={handleFetchError}
      onOpenChange={onOpenChange}
    />
  );
};

export default GlossaryTermPicker;
