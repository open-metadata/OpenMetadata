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
  Autocomplete,
  Box,
  ButtonUtility,
  Slider,
  Typography,
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TermBoost } from '../../../../../../../generated/configuration/searchSettings';
import tagClassBase from '../../../../../../../utils/TagClassBase';
import { showErrorToast } from '../../../../../../../utils/ToastUtils';

const SEARCH_DEBOUNCE_MS = 300;

export const MAX_BOOST = 100;
export const BOOST_STEP = 0.1;

interface TagOption {
  id: string;
  label: string;
  field: string;
}

/** Tiers and certifications are indexed under their own fields, not tags. */
export const getTermBoostField = (tagFqn: string) => {
  if (tagFqn.startsWith('Certification.')) {
    return 'certification.tagLabel.tagFQN';
  }

  return tagFqn.startsWith('Tier.') ? 'tier.tagFQN' : 'tags.tagFQN';
};

interface TermBoostCardProps {
  termBoost?: TermBoost;
  onChange: (termBoost: TermBoost) => void;
  onDelete: (tagFqn: string) => void;
}

/**
 * One term boost: pick a tag (fixed once saved) and its boost. Every change
 * is reported up; the caller decides when a boost is complete enough to keep.
 */
const TermBoostCard = ({
  termBoost,
  onChange,
  onDelete,
}: TermBoostCardProps) => {
  const { t } = useTranslation();
  const isExisting = Boolean(termBoost?.value);
  const [draft, setDraft] = useState<TermBoost>(
    termBoost ?? { field: '', value: '', boost: 0 }
  );
  const [options, setOptions] = useState<TagOption[]>([]);

  useEffect(() => {
    if (termBoost?.value) {
      setDraft(termBoost);
    }
  }, [termBoost]);

  const fetchTags = useCallback(async (searchText: string) => {
    try {
      const response = await tagClassBase.getTags(searchText, 1, true);
      setOptions(
        response.data.map(({ data }) => {
          const fqn = data.fullyQualifiedName ?? '';

          return { id: fqn, label: fqn, field: getTermBoostField(fqn) };
        })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  }, []);

  const debouncedFetch = useMemo(
    () => debounce(fetchTags, SEARCH_DEBOUNCE_MS),
    [fetchTags]
  );

  useEffect(() => {
    if (!isExisting) {
      void fetchTags('');
    }

    return () => debouncedFetch.cancel();
  }, [debouncedFetch, fetchTags, isExisting]);

  const update = (next: TermBoost) => {
    setDraft(next);
    onChange(next);
  };

  // Autocomplete re-syncs its selection whenever this identity changes.
  const selectedItems = useMemo(
    () => (draft.value ? [{ id: draft.value, label: draft.value }] : []),
    [draft.value]
  );

  return (
    <Box
      className="tw:w-64 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:p-4"
      data-testid={`term-boost-${draft.value || 'new'}`}
      direction="col"
      gap={4}>
      <Autocomplete
        aria-label={t('label.select-tag')}
        data-testid="term-boost-select"
        isDisabled={isExisting}
        items={options}
        multiple={false}
        placeholder={t('label.select-tag')}
        selectedItems={selectedItems}
        onItemCleared={() => update({ ...draft, field: '', value: '' })}
        onItemInserted={(key) => {
          const option = options.find((item) => item.id === String(key));
          if (option) {
            update({ ...draft, field: option.field, value: option.id });
          }
        }}
        onSearchChange={debouncedFetch}>
        {(item) => <Autocomplete.Item id={item.id} label={item.label} />}
      </Autocomplete>

      <Box direction="col" gap={1}>
        <Box align="center" direction="row" justify="between">
          <Typography className="tw:text-secondary" size="text-sm">
            {t('label.boost')}
          </Typography>
          <Typography
            className="tw:text-brand-secondary"
            data-testid="term-boost-value"
            size="text-sm"
            weight="semibold">
            {draft.boost}
          </Typography>
        </Box>
        <Slider
          aria-label={t('label.boost')}
          data-testid="term-boost-slider"
          maxValue={MAX_BOOST}
          minValue={0}
          step={BOOST_STEP}
          value={draft.boost}
          onChange={(value) =>
            update({ ...draft, boost: Array.isArray(value) ? value[0] : value })
          }
        />
      </Box>

      <ButtonUtility
        className="tw:self-end"
        color="tertiary"
        data-testid="delete-term-boost"
        icon={Trash01}
        size="xs"
        tooltip={t('label.delete')}
        onPress={() => onDelete(draft.value)}
      />
    </Box>
  );
};

export default TermBoostCard;
