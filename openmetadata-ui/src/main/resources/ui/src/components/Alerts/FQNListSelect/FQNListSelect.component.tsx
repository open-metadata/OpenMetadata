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

import {
  Autocomplete,
  BadgeWithButton,
  Box,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { debounce, uniqBy } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../../enums/search.enum';
import { NameSearch } from '../../../utils/Alerts/AlertSourceSearch';
import { showErrorToast } from '../../../utils/ToastUtils';
import { resolveWildcardFqns } from './FQNListSelect.utils';

export { resolveWildcardFqns } from './FQNListSelect.utils';

interface FQNListSelectProps {
  api: NameSearch;
  value?: string[];
  onChange?: (value: string[]) => void;
  searchIndex: SearchIndex | SearchIndex[];
  containerEntities?: string[];
  placeholder?: string;
  'data-testid'?: string;
  isDisabled?: boolean;
  hint?: string;
  className?: string;
}

const EMPTY_VALUES: string[] = [];

const FQNListSelect = ({
  api,
  value = EMPTY_VALUES,
  onChange,
  searchIndex,
  containerEntities = EMPTY_VALUES,
  placeholder,
  'data-testid': testId,
  isDisabled = false,
  hint,
  className,
}: FQNListSelectProps) => {
  const { t } = useTranslation();
  const [wildcards, setWildcards] = useState<string[]>([]);
  const [items, setItems] = useState<SelectItemType[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  useEffect(() => {
    let active = true;
    resolveWildcardFqns(value, searchIndex, containerEntities).then((found) => {
      if (active) {
        setWildcards(found);
      }
    });

    return () => {
      active = false;
    };
  }, [value, searchIndex, containerEntities]);
  const search = useMemo(
    () =>
      debounce(async (text: string) => {
        const id = ++requestId.current;
        setLoading(true);
        try {
          const options = await api(text);
          if (id === requestId.current) {
            setItems(
              uniqBy(
                options.map((option) => ({
                  id: option.value,
                  label: option.label,
                })),
                'id'
              )
            );
          }
        } catch (error) {
          if (id === requestId.current) {
            showErrorToast(error as AxiosError);
          }
        } finally {
          if (id === requestId.current) {
            setLoading(false);
          }
        }
      }, 400),
    [api]
  );
  useEffect(() => {
    search('');

    return () => {
      search.cancel();
      requestId.current++;
    };
  }, [search]);
  const selectedItems = value.map((id) => ({
    id,
    label: wildcards.includes(id) ? id + '.*' : id,
  }));

  return (
    <Box className={className} direction="col" gap={2}>
      <Autocomplete
        aria-busy={loading}
        aria-label={placeholder}
        data-testid={testId}
        filterOption={() => true}
        hint={hint}
        icon={null}
        isDisabled={isDisabled}
        isInvalid={Boolean(hint)}
        items={items}
        placeholder={placeholder}
        renderTag={(item, onRemove) => (
          <BadgeWithButton
            buttonLabel={t('label.remove')}
            color="gray"
            data-testid={'fqn-tag-' + item.id}
            size="sm"
            title={item.label}
            onButtonClick={onRemove}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}>
            <Typography className="break-all">{item.label}</Typography>
          </BadgeWithButton>
        )}
        selectedItems={selectedItems}
        onItemCleared={(key) =>
          onChange?.(value.filter((id) => id !== String(key)))
        }
        onItemInserted={(key) =>
          onChange?.([...new Set([...value, String(key)])])
        }
        onSearchChange={search}>
        {(item) => (
          <Autocomplete.Item id={item.id} textValue={item.label}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    </Box>
  );
};

export default FQNListSelect;
