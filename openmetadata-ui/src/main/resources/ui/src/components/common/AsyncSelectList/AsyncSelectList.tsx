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
import {
  Autocomplete,
  Box,
  Button,
  ClassificationTag,
  GlossaryTag,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { debounce, isEmpty, isString, pick } from 'lodash';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Tag } from '../../../generated/entity/classification/tag';
import { LabelType } from '../../../generated/entity/data/table';
import { Paging } from '../../../generated/type/paging';
import { TagLabel, TagSource } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { ensureComboboxMenuOpen } from '../../../utils/formPureUtils';
import Fqn from '../../../utils/Fqn';
import { getTagDisplay } from '../../../utils/TagsPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../Loader/Loader';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

const EMPTY_OPTION_ID = '__async-select-list-empty__';
const CONTENT_LOADING_OPTION_ID = '__async-select-list-loading__';

const AsyncSelectList: FC<AsyncSelectListProps> = ({
  mode,
  onChange,
  fetchOptions,
  debounceTimeout = 800,
  initialOptions,
  filterOptions = [],
  optionClassName,
  onCancel,
  isSubmitLoading,
  newLook = false,
  dropdownContainerRef,
  autoFocus,
  open,
  className,
  popupClassName,
  placeholder,
  defaultValue,
  value,
  id,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTags, setSelectedTags] = useState<SelectOption[]>(
    initialOptions ?? []
  );
  const [internalValue, setInternalValue] = useState<string[]>(
    () => defaultValue ?? initialOptions?.map((option) => option.value) ?? []
  );
  const { t } = useTranslation();
  const [optionFilteredCount, setOptionFilteredCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = useMemo(
    () =>
      value?.map((item) => (isString(item) ? item : item.value)) ??
      internalValue,
    [value, internalValue]
  );

  const getFilteredOptions = (data: SelectOption[]) => {
    if (isEmpty(filterOptions)) {
      return data;
    }

    let count = optionFilteredCount;

    const filteredData = data.filter((item) => {
      const isFiltered = filterOptions.includes(
        (item.data as Tag)?.fullyQualifiedName ?? ''
      );
      if (isFiltered) {
        count = optionFilteredCount + 1;
      }

      return !isFiltered;
    });

    setOptionFilteredCount(count);

    return filteredData;
  };

  const loadOptions = useCallback(
    async (value: string) => {
      setOptions([]);
      setIsLoading(true);
      try {
        const res = await fetchOptions(value, 1);
        setOptions(getFilteredOptions(res.data));
        setPaging(res.paging);
        setSearchValue(value);
        setCurrentPage(1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions]
  );

  const debounceFetcher = useMemo(
    () => debounce(loadOptions, debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  const tagOptions = useMemo(() => {
    const newTags = options.map((tag) => {
      const displayName = tag.data?.displayName;
      const parts = Fqn.split(tag.label);
      const lastPartOfTag = isEmpty(displayName)
        ? parts.slice(-1).join(FQN_SEPARATOR_CHAR)
        : displayName;
      parts.pop();

      return {
        label: tag.label,
        displayName: (
          <Box className="tw:w-full" direction="col">
            <Typography ellipsis as="p" className="m-0 p-0" color="secondary">
              {parts.join(FQN_SEPARATOR_CHAR)}
            </Typography>
            <Typography ellipsis style={{ color: tag.data?.style?.color }}>
              {lastPartOfTag}
            </Typography>
          </Box>
        ),
        value: tag.value,
        data: tag.data,
      };
    });

    return newTags;
  }, [options]);

  const items = useMemo(() => {
    if (isEmpty(tagOptions)) {
      return [{ id: EMPTY_OPTION_ID }];
    }

    const optionItems = tagOptions.map((option) => ({
      id: option.value,
      label: option.label,
    }));

    return hasContentLoading
      ? [...optionItems, { id: CONTENT_LOADING_OPTION_ID }]
      : optionItems;
  }, [tagOptions, hasContentLoading]);

  const selectedItems = useMemo(
    () => selectedValues.map((value) => ({ id: value, label: value })),
    [selectedValues]
  );

  const onScroll = async (e: React.UIEvent<HTMLElement>) => {
    const { currentTarget } = e;
    // optionFilteredCount added to equalize the options received from the server
    if (
      currentTarget.scrollTop + currentTarget.offsetHeight ===
        currentTarget.scrollHeight &&
      options.length + optionFilteredCount < paging.total
    ) {
      try {
        setHasContentLoading(true);
        const res = await fetchOptions(searchValue, currentPage + 1);
        setOptions((prev) => [...prev, ...getFilteredOptions(res.data)]);
        setPaging(res.paging);
        setCurrentPage((prev) => prev + 1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setHasContentLoading(false);
      }
    }
  };

  // The core popover is portaled and remounted on every open; expose its node
  // so callers (the bulk-edit grid) can keep it inside their focus trap.
  const handleOpenChange = (isOpen: boolean) => {
    if (!dropdownContainerRef || !isOpen) {
      return;
    }
    requestAnimationFrame(() => {
      const listBoxId = containerRef.current
        ?.querySelector('input')
        ?.getAttribute('aria-controls');
      const listBox = listBoxId ? document.getElementById(listBoxId) : null;
      (
        dropdownContainerRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = listBox?.closest<HTMLDivElement>('[data-trigger]') ?? null;
    });
  };

  const renderTag = (item: { id: string }, onRemove: () => void) => {
    const selectedTag = selectedTags.find((tag) => tag.value === item.id);

    const tag = {
      tagFQN: (selectedTag?.data as Tag)?.fullyQualifiedName,
      ...pick(
        selectedTag?.data,
        'description',
        'displayName',
        'name',
        'style',
        'tagFQN'
      ),
    } as TagLabel;
    const tagDisplayName = getTagDisplay(item.id);
    const tagLabel = getEntityName(tag) || tagDisplayName || tag.tagFQN;

    const isDerived =
      (selectedTag?.data as TagLabel)?.labelType === LabelType.Derived;
    const isGlossaryTerm =
      (selectedTag?.data as TagLabel)?.source === TagSource.Glossary ||
      (selectedTag?.data as { entityType?: EntityType })?.entityType ===
        EntityType.GLOSSARY_TERM;
    const TagComponent = isGlossaryTerm ? GlossaryTag : ClassificationTag;

    return (
      <TagComponent
        closeButtonTestId="remove-tags"
        color={tag.style?.color}
        data-testid={`selected-tag-${tagDisplayName}`}
        icon={tag.style?.iconURL}
        key={item.id}
        label={tagLabel}
        size="sm"
        tooltip={isDerived ? t('message.derived-tag-warning') : undefined}
        onDelete={
          isDerived
            ? undefined
            : (e) => {
                e.stopPropagation();
                onRemove();
              }
        }
      />
    );
  };

  const handleChange = (values: string[]) => {
    const newSelectedTags = values.map((value) => {
      const initialData = initialOptions?.find(
        (item) => item.value === value
      )?.data;
      const option =
        options.find((option) => option.value === value) ??
        selectedTags.find((tag) => tag.value === value);

      return (
        (initialData
          ? {
              value,
              label: value,
              data: initialData,
            }
          : option) ?? {
          value,
          label: value,
        }
      );
    });
    setInternalValue(values);
    setSelectedTags(newSelectedTags);
    onChange?.(newSelectedTags);
  };

  useEffect(() => {
    loadOptions('');
  }, []);

  return (
    <div
      className={classNames('async-select-list tw:w-full', className, {
        'new-chip-style': newLook,
      })}
      ref={containerRef}>
      <Autocomplete
        // eslint-disable-next-line jsx-a11y/no-autofocus -- callers opt in, e.g. the bulk-edit cell editor
        autoFocus={autoFocus || open}
        data-testid="tag-selector"
        filterOption={() => true}
        icon={null}
        id={id}
        items={items}
        multiple={mode === 'multiple'}
        placeholder={placeholder}
        popoverClassName={classNames(
          'async-select-list-dropdown',
          popupClassName
        )}
        renderTag={renderTag}
        selectedItems={selectedItems}
        onItemCleared={(key) =>
          handleChange(selectedValues.filter((value) => value !== String(key)))
        }
        onItemInserted={(key) => {
          handleChange([...selectedValues, String(key)]);
          // antd kept a multi select open after a pick; do the same.
          ensureComboboxMenuOpen(() =>
            containerRef.current?.querySelector('input')
          );
        }}
        onKeyDown={(event) => {
          // Backspace must not reach the grid/editor around this field.
          if (event.key !== 'Backspace') {
            event.continuePropagation();
          }
        }}
        onOpenChange={handleOpenChange}
        onPopoverScroll={onScroll}
        onSearchChange={debounceFetcher}>
        {(item) => {
          if (item.id === EMPTY_OPTION_ID) {
            return (
              <Autocomplete.Item isDisabled id={EMPTY_OPTION_ID}>
                {isLoading ? (
                  <Loader size="small" />
                ) : (
                  <Typography as="p" className="tw:w-full tw:text-center">
                    {t('label.no-entity-available', {
                      entity: t('label.tag-plural'),
                    })}
                  </Typography>
                )}
              </Autocomplete.Item>
            );
          }

          if (item.id === CONTENT_LOADING_OPTION_ID) {
            return (
              <Autocomplete.Item isDisabled id={CONTENT_LOADING_OPTION_ID}>
                <Loader size="small" />
              </Autocomplete.Item>
            );
          }

          const option = tagOptions.find((tag) => tag.value === item.id);

          return (
            <Autocomplete.Item
              className={classNames(optionClassName, 'w-full')}
              data-testid={`tag-${item.id}`}
              id={item.id}
              key={item.label}
              textValue={item.label}>
              <Tooltip
                delay={1.5}
                placement="top left"
                title={item.label}
                trigger="hover">
                {option?.displayName}
              </Tooltip>
            </Autocomplete.Item>
          );
        }}
      </Autocomplete>
      {onCancel && (
        <Box className="p-sm p-b-xss p-l-xs custom-dropdown-render" gap={2}>
          <Button
            className="update-btn"
            color="secondary"
            data-testid="saveAssociatedTag"
            isDisabled={
              isEmpty(value ?? selectedTags) && isEmpty(initialOptions)
            }
            isLoading={isSubmitLoading}
            size="xs"
            type="submit">
            {t('label.update')}
          </Button>
          <Button
            color="secondary"
            data-testid="cancelAssociatedTag"
            size="xs"
            onPress={onCancel}>
            {t('label.cancel')}
          </Button>
        </Box>
      )}
    </div>
  );
};

export default AsyncSelectList;
