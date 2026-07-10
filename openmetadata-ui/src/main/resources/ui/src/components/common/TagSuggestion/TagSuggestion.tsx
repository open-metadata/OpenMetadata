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

import {
  Autocomplete,
  BadgeWithButton,
  Dot,
  type SelectItemType,
} from '@openmetadata/ui-core-components';
import { debounce } from 'lodash';
import { EntityTags } from 'Models';
import {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../../generated/entity/classification/tag';
import { TagSource } from '../../../generated/entity/data/container';
import { GlossaryTerm } from '../../../generated/entity/data/glossaryTerm';
import { TagLabel } from '../../../generated/type/tagLabel';
import { ensureComboboxMenuOpen } from '../../../utils/formPureUtils';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay } from '../../../utils/TagsPureUtils';
import { fetchGlossaryList } from '../../../utils/TagsUtils';

type TagSelectItem = SelectItemType & { labelColor?: string };

const NO_DATA_OPTION_ID = '__no-data__';

export type SelectOption = {
  label: string;
  value: string;
  data?: Tag | GlossaryTerm | TagLabel;
};

export interface TagSuggestionProps {
  placeholder?: string;
  value?: TagLabel[];
  initialOptions?: SelectOption[];
  onChange?: (newTags: TagLabel[]) => void;
  label?: string;
  required?: boolean;
  tagType?: TagSource;
}

const TAG_DATA_CACHE_MAX_SIZE = 200;

// Bounded insert for the tag-metadata lookup: refreshes recency and evicts the
// oldest entry once the cap is reached so a long-lived form with many searches
// cannot grow the cache without limit.
const setBoundedTagData = (
  cache: Map<string, TagLabel>,
  key: string,
  data: TagLabel
): void => {
  cache.delete(key);
  cache.set(key, data);
  while (cache.size > TAG_DATA_CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    cache.delete(oldestKey);
  }
};

const TagSuggestion: FC<TagSuggestionProps> = ({
  onChange,
  value = [],
  placeholder,
  initialOptions = [],
  label,
  required = false,
  tagType = TagSource.Classification,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<TagSelectItem[]>([]);
  const tagDataMap = useRef<Map<string, TagLabel>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedItems = useMemo<TagSelectItem[]>(
    () =>
      value.map((tag) => ({
        id: tag.tagFQN,
        label: getTagDisplay(tag.displayName || tag.name) || tag.tagFQN,
        supportingText: tag.displayName || tag.name,
        value: tag,
      })),
    [value]
  );

  const fetchOptions = async (searchText: string) => {
    try {
      const response =
        tagType === TagSource.Glossary
          ? await fetchGlossaryList(searchText, 1)
          : await tagClassBase.getTags(searchText, 1, true);
      const fetched: SelectOption[] = response?.data || [];
      fetched.forEach((opt) => {
        setBoundedTagData(tagDataMap.current, opt.value, opt.data as TagLabel);
      });
      setOptions(
        fetched.map((opt) => {
          const style = (opt.data as TagLabel)?.style;

          return {
            id: opt.value,
            label: opt.label,
            supportingText: (opt.data as TagLabel)?.displayName || opt.label,
            labelColor: style?.color,
          };
        })
      );
    } catch {
      setOptions([]);
    }
  };

  const searchDebounced = useRef(
    debounce(async (searchValue: string) => {
      await fetchOptions(searchValue);
    }, 250)
  ).current;

  useEffect(() => {
    if (initialOptions.length > 0) {
      initialOptions.forEach((opt) => {
        setBoundedTagData(tagDataMap.current, opt.value, opt.data as TagLabel);
      });
      setOptions(
        initialOptions.map((opt) => {
          const style = (opt.data as TagLabel)?.style;

          return {
            id: opt.value,
            label: opt.label,
            supportingText: (opt.data as TagLabel)?.displayName || opt.label,
            labelColor: style?.color,
          };
        })
      );
    } else {
      fetchOptions('');
    }
  }, []);

  const handleSearchChange = useCallback(
    (searchText: string) => {
      if (searchText === '') {
        searchDebounced.cancel();
        fetchOptions('');
      } else {
        searchDebounced(searchText);
      }
    },
    [searchDebounced]
  );

  const handleItemInserted = useCallback(
    (key: string | number) => {
      if (String(key) === NO_DATA_OPTION_ID) {
        return;
      }
      // Ignore re-insertion of an already-selected tag; appending it again
      // would create a duplicate that flows into the payload.
      if (value.some((tag) => tag.tagFQN === String(key))) {
        return;
      }
      const tagData = tagDataMap.current.get(String(key));
      const newTag: EntityTags = {
        tagFQN: String(key),
        source: tagType,
        name: tagData?.name,
        displayName: tagData?.displayName,
        description: tagData?.description,
        style: tagData?.style,
      };

      onChange?.([...value, newTag]);
      searchDebounced.cancel();
      fetchOptions('');
    },
    [value, onChange, searchDebounced, tagType]
  );

  const handleItemCleared = useCallback(
    (key: string | number) => {
      onChange?.(value.filter((tag) => tag.tagFQN !== String(key)));
    },
    [value, onChange]
  );

  // Force the menu open on a click of the field itself, but not on a click of
  // its label. A label click focuses the input (opening it via focus would be
  // surprising); gating on pointer target keeps click-to-open on the field
  // while leaving the label inert. Pointer-driven (not onFocus) so it survives
  // the focus-time re-render that would otherwise cancel the menu.
  const handleFieldPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).closest('label')) {
        return;
      }
      ensureComboboxMenuOpen(() =>
        containerRef.current?.querySelector('input')
      );
    },
    []
  );

  const displayOptions = useMemo<TagSelectItem[]>(
    () =>
      options.length > 0
        ? options
        : [{ id: NO_DATA_OPTION_ID, label: t('label.no-data') }],
    [options, t]
  );

  return (
    <div
      data-testid="tag-suggestion"
      ref={containerRef}
      onPointerDown={handleFieldPointerDown}>
      <Autocomplete
        filterOption={() => true}
        isRequired={required}
        items={displayOptions}
        label={label}
        placeholder={
          placeholder ??
          t('label.select-field', { field: t('label.tag-plural') })
        }
        renderTag={(item, onRemove) => {
          const tagColor = tagDataMap.current.get(String(item.id))?.style
            ?.color;

          return (
            <BadgeWithButton
              key={item.id}
              size="sm"
              type="color"
              onButtonClick={onRemove}>
              {tagColor && (
                <Dot
                  size="sm"
                  style={{ color: tagColor, marginRight: '2px' }}
                />
              )}
              {item.label ?? item.id}
            </BadgeWithButton>
          );
        }}
        selectedItems={selectedItems}
        onItemCleared={handleItemCleared}
        onItemInserted={handleItemInserted}
        onSearchChange={handleSearchChange}>
        {(item) => {
          const tagItem = item as TagSelectItem;

          if (tagItem.id === NO_DATA_OPTION_ID) {
            return (
              <Autocomplete.Item
                isDisabled
                data-testid="no-data-option"
                id={NO_DATA_OPTION_ID}
                key={NO_DATA_OPTION_ID}
                label={tagItem.label}>
                {() => (
                  <span className="tw:text-sm tw:text-tertiary">
                    {tagItem.label}
                  </span>
                )}
              </Autocomplete.Item>
            );
          }

          return (
            <Autocomplete.Item
              data-testid={`tag-option-${tagItem.id}`}
              id={String(tagItem.id)}
              key={tagItem.id}
              label={tagItem.label}
              supportingText={tagItem.supportingText}>
              {({ isDisabled }) => (
                <div className="tw:flex tw:flex-col tw:gap-y-0.5 tw:min-w-0 tw:flex-1">
                  <span
                    className="tw:truncate tw:text-md tw:font-medium tw:whitespace-nowrap"
                    style={
                      tagItem.labelColor && !isDisabled
                        ? { color: tagItem.labelColor }
                        : undefined
                    }>
                    {tagItem.label}
                  </span>
                  {tagItem.supportingText && (
                    <span className="tw:text-sm tw:whitespace-nowrap tw:text-tertiary">
                      {tagItem.supportingText}
                    </span>
                  )}
                </div>
              )}
            </Autocomplete.Item>
          );
        }}
      </Autocomplete>
    </div>
  );
};

export default TagSuggestion;
