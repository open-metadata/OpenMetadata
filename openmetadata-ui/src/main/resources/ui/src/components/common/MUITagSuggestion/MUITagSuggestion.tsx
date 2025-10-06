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

import { Autocomplete, Box, TextField } from '@mui/material';
import { debounce, isArray, isEmpty } from 'lodash';
import { EntityTags } from 'Models';
import {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TagSource } from '../../../generated/entity/data/container';
import { TagLabel } from '../../../generated/type/tagLabel';
import tagClassBase from '../../../utils/TagClassBase';
import { getTagDisplay } from '../../../utils/TagsUtils';
import { SelectOption } from '../AsyncSelectList/AsyncSelectList.interface';
import { TagChip } from '../atoms/TagChip';

interface TagOption {
  label: string;
  value: string;
  data: TagLabel;
}

export interface MUITagSuggestionProps {
  placeholder?: string;
  value?: TagLabel[];
  initialOptions?: SelectOption[];
  onChange?: (newTags: TagLabel[]) => void;
  autoFocus?: boolean;
  label?: ReactNode;
  required?: boolean;
}

const MUITagSuggestion: FC<MUITagSuggestionProps> = ({
  onChange,
  value = [],
  placeholder,
  initialOptions = [],
  autoFocus = false,
  label,
  required = false,
}) => {
  const [options, setOptions] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const searchDebounced = useRef(
    debounce(async (searchValue: string) => {
      await fetchOptions(searchValue);
    }, 250)
  ).current;

  // Fetch initial options on mount
  useEffect(() => {
    if (isEmpty(options) && isEmpty(initialOptions)) {
      fetchOptions('');
    }
  }, []);

  // Handle input changes
  useEffect(() => {
    if (inputValue) {
      setLoading(true);
      searchDebounced(inputValue);
    } else {
      setLoading(true);
      setOptions([]);
      searchDebounced('');
    }
  }, [inputValue]);

  // Fetch initial options when dropdown opens
  useEffect(() => {
    if (open && options.length === 0 && !inputValue) {
      searchDebounced('');
    }
  }, [open]);

  const fetchOptions = async (searchText: string) => {
    setLoading(true);
    try {
      const response = await tagClassBase.getTags(searchText, 1, 20);
      const fetchedOptions = response?.data || [];
      const mappedOptions: TagOption[] = fetchedOptions.map(
        (opt: SelectOption) => ({
          label: opt.label,
          value: opt.value,
          data: opt.data as TagLabel,
        })
      );
      setOptions(mappedOptions);
    } catch (error) {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = useCallback(
    (_event: React.SyntheticEvent, newInputValue: string) => {
      setInputValue(newInputValue);
    },
    []
  );

  const handleChange = useCallback(
    (
      event: React.SyntheticEvent,
      newValue: (TagOption | string)[],
      reason: string
    ) => {
      if (isArray(newValue)) {
        // Filter out string values from freeSolo
        const optionValues = newValue.filter(
          (v): v is TagOption => typeof v !== 'string'
        );

        const newTags: EntityTags[] = optionValues.map((option) => {
          const existingTag = value.find((tag) => tag.tagFQN === option.value);
          if (existingTag) {
            return existingTag;
          }

          return {
            tagFQN: option.value,
            source: TagSource.Classification,
            name: option.data?.name,
            displayName: option.data?.displayName,
            description: option.data?.description,
            style: option.data?.style,
          };
        });

        onChange?.(newTags);
      }
    },
    [value, onChange]
  );

  const selectedOptions: TagOption[] = useMemo(() => {
    return value.map((tag) => ({
      label: getTagDisplay(tag.displayName || tag.name) || tag.tagFQN,
      value: tag.tagFQN,
      data: tag,
    }));
  }, [value]);

  const memoizedOptions = useMemo(() => options, [options]);

  // Tag autocomplete
  return (
    <Autocomplete
      disableCloseOnSelect
      freeSolo
      multiple
      // Force listbox to remount when options change to fix async search not updating dropdown
      // Using 'as any' because key is not in MUI's ListboxProps type definition
      ListboxProps={
        {
          key: `listbox-${memoizedOptions.length}`,
        } as any
      }
      autoFocus={autoFocus}
      getOptionLabel={(option: TagOption | string) =>
        typeof option === 'string' ? option : option.label
      }
      inputValue={inputValue}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      loading={loading}
      open={open && (memoizedOptions.length > 0 || loading)}
      options={memoizedOptions}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          label={label}
          placeholder={
            placeholder ??
            t('label.select-field', {
              field: t('label.tag-plural'),
            })
          }
          required={required}
          size="small"
          slotProps={{
            inputLabel: {
              shrink: true,
            },
          }}
          variant="outlined"
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <Box display="flex" flexDirection="column">
            <Box
              fontWeight="medium"
              sx={{ color: option.data?.style?.color || undefined }}>
              {option.label}
            </Box>
            {(option.data?.displayName || option.data?.name) && (
              <Box color="text.secondary" fontSize="0.875rem">
                {option.data?.displayName || option.data?.name}
              </Box>
            )}
          </Box>
        </Box>
      )}
      renderTags={(value: TagOption[], getTagProps) =>
        value.map((option: TagOption, index: number) => {
          const chipProps = getTagProps({ index });

          return (
            <TagChip
              {...chipProps}
              key={option.value}
              label={option.label}
              size="small"
              tagColor={option.data?.style?.color}
            />
          );
        })
      }
      value={selectedOptions}
      onChange={handleChange}
      onClose={() => setOpen(false)}
      onInputChange={handleInputChange}
      onOpen={() => setOpen(true)}
    />
  );
};

export default MUITagSuggestion;
