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
  FilterSelect,
  FilterSelectOption,
  FormItemLabel,
} from '@openmetadata/ui-core-components';
import { Icon } from '@openmetadata/ui-core-components/icon';
import { Tag } from '@openmetadata/ui-core-components/icons';
import { debounce } from 'lodash';
import {
  FC,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TagLabel } from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import { TagSelectorProps } from './TagSelector.types';
import {
  buildTagLabelFromFqn,
  buildTagLabelFromResult,
  getTagDisplayLabel,
  getTagStyle,
  RawTagResult,
} from './TagSelector.utils';

const TAG_CACHE_MAX = 200;

const resultToOption = (result: RawTagResult): FilterSelectOption => {
  const label = getTagDisplayLabel(result);
  const style = getTagStyle(result);
  const icon = style?.iconURL ? (
    <Suspense fallback={null}>
      <Icon iconValue={style.iconURL} size={16} />
    </Suspense>
  ) : (
    <Tag height={16} width={16} />
  );

  return { value: result.value, label, textValue: label, icon };
};

const TagSelector: FC<TagSelectorProps> = ({
  value,
  onChange,
  label,
  placeholder,
  required,
  disabled,
  commitMode = 'immediate',
  triggerVariant = 'input',
  triggerDisplay = 'chips',
  className,
  popoverClassName,
  isOpen,
  onOpenChange,
}) => {
  const { t } = useTranslation();
  const [options, setOptions] = useState<FilterSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [popoverWidth, setPopoverWidth] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const tagCacheRef = useRef<Map<string, TagLabel>>(new Map());
  const requestIdRef = useRef(0);
  const hasInitializedRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const observer = new ResizeObserver(() => {
      setPopoverWidth(el.getBoundingClientRect().width + 'px');
    });
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const cacheTag = useCallback((tag: TagLabel) => {
    const cache = tagCacheRef.current;
    if (cache.size >= TAG_CACHE_MAX) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(tag.tagFQN, tag);
  }, []);

  const fetchTags = useCallback(
    async (searchText: string) => {
      const id = ++requestIdRef.current;
      setIsLoading(true);
      try {
        const response = await tagClassBase.getTags(searchText, 1);
        if (id !== requestIdRef.current) {
          return;
        }
        const results = response?.data ?? [];
        const fetchedOptions = results.map((result) => {
          const tag = buildTagLabelFromResult(result);
          cacheTag(tag);

          return resultToOption(result);
        });
        setOptions(fetchedOptions);
      } catch {
        if (id === requestIdRef.current) {
          setOptions([]);
        }
      } finally {
        if (id === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [cacheTag]
  );

  const debouncedSearch = useMemo(
    () => debounce((text: string) => void fetchTags(text), 300),
    [fetchTags]
  );

  useEffect(
    () => () => {
      debouncedSearch.cancel();
    },
    [debouncedSearch]
  );

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && !hasInitializedRef.current) {
        hasInitializedRef.current = true;
        void fetchTags('');
      }
      onOpenChange?.(open);
    },
    [fetchTags, onOpenChange]
  );

  const selectedValues = useMemo(() => value.map((tag) => tag.tagFQN), [value]);

  const handleChange = useCallback(
    (fqns: string[]) => {
      const cache = tagCacheRef.current;
      const existing = new Map(value.map((tag) => [tag.tagFQN, tag]));
      const tags = fqns.map(
        (fqn) =>
          existing.get(fqn) ?? cache.get(fqn) ?? buildTagLabelFromFqn(fqn)
      );
      onChange(tags);
    },
    [onChange, value]
  );

  const handleResolveMissingLabel = useCallback((fqn: string) => {
    const cached = tagCacheRef.current.get(fqn);

    return cached?.displayName ?? cached?.name ?? fqn;
  }, []);

  const resolvedLabel = label ?? t('label.tag-plural');

  return (
    <div
      aria-disabled={disabled || undefined}
      className={`tw:flex tw:flex-col tw:gap-1.5 tw:w-full${
        disabled ? ' tw:pointer-events-none tw:opacity-50' : ''
      }`}
      ref={containerRef}>
      {label !== undefined && (
        <FormItemLabel label={resolvedLabel} required={required} />
      )}
      <FilterSelect
        hideCounts
        searchable
        className={className}
        commitMode={commitMode}
        isLoading={isLoading}
        isOpen={isOpen}
        label={resolvedLabel}
        options={options}
        placeholder={placeholder}
        popoverClassName={popoverClassName}
        popoverStyle={popoverWidth ? { width: popoverWidth } : undefined}
        resolveMissingLabel={handleResolveMissingLabel}
        selectedValues={selectedValues}
        triggerDisplay={triggerDisplay}
        triggerVariant={triggerVariant}
        onChange={handleChange}
        onOpenChange={handleOpenChange}
        onSearch={debouncedSearch}
      />
    </div>
  );
};

export default TagSelector;
