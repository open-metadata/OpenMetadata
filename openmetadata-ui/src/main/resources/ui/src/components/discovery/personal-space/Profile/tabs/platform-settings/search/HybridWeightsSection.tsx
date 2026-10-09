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
  Box,
  Button,
  Slider,
  Typography,
} from '@openmetadata/ui-core-components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchSectionTitle } from './SearchSection';
import {
  complementWeight,
  DEFAULT_SEMANTIC_WEIGHT,
} from './SearchSettings.utils';

interface HybridWeightsSectionProps {
  savedWeight?: number;
  isDisabled: boolean;
  onSave: (semanticWeight: number) => void;
}

/** One slider splits the ranking between semantic and keyword matching. */
const HybridWeightsSection = ({
  savedWeight = DEFAULT_SEMANTIC_WEIGHT,
  isDisabled,
  onSave,
}: HybridWeightsSectionProps) => {
  const { t } = useTranslation();
  const [weight, setWeight] = useState(savedWeight);

  return (
    <Box data-testid="hybrid-search-weights" direction="col" gap={3}>
      <Box align="center" direction="row" justify="between">
        <SearchSectionTitle>
          {t('label.hybrid-search-weight-plural')}
        </SearchSectionTitle>
        <Button
          color="primary"
          data-testid="hybrid-weights-save-btn"
          isDisabled={isDisabled || weight === savedWeight}
          size="sm"
          onPress={() => onSave(weight)}>
          {t('label.save')}
        </Button>
      </Box>
      <Box
        align="center"
        className="tw:rounded-xl tw:border tw:border-secondary tw:bg-surface tw:px-5 tw:py-4"
        direction="row"
        gap={6}>
        <Typography data-testid="keyword-weight" size="text-sm">
          {`${t('label.keyword')}: ${complementWeight(weight).toFixed(1)}`}
        </Typography>
        <Slider
          aria-label={t('label.hybrid-search-weight-plural')}
          className="tw:flex-1"
          isDisabled={isDisabled}
          maxValue={1}
          minValue={0}
          step={0.1}
          value={weight}
          onChange={(value) =>
            setWeight(Array.isArray(value) ? value[0] : value)
          }
        />
        <Typography data-testid="semantic-weight" size="text-sm">
          {`${t('label.semantic')}: ${weight.toFixed(1)}`}
        </Typography>
      </Box>
    </Box>
  );
};

export default HybridWeightsSection;
