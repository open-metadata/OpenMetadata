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
  Badge,
  Box,
  ButtonUtility,
  Card,
  Select,
  Slider,
  Toggle,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  ChevronDown,
  ChevronUp,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FieldBoost,
  SearchFieldMatchType as MatchType,
} from '../../../../../../../generated/configuration/searchSettings';
import { BOOST_STEP, MAX_BOOST } from './TermBoostCard';

interface MatchingFieldCardProps {
  field: FieldBoost;
  description?: string;
  /** The server only allows highlighting analyzed text fields. */
  isHighlightAllowed: boolean;
  isHighlighted: boolean;
  initialOpen?: boolean;
  onChange: (update: Partial<FieldBoost>) => void;
  onToggleHighlight: () => void;
  onDelete: () => void;
}

/** One matching field: weight, match type and highlighting, collapsed to a summary. */
const MatchingFieldCard = ({
  field,
  description,
  isHighlightAllowed,
  isHighlighted,
  initialOpen = false,
  onChange,
  onToggleHighlight,
  onDelete,
}: MatchingFieldCardProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(initialOpen);
  const weight = field.boost ?? 0;
  const matchTypeItems = [
    { id: MatchType.Exact, label: t('label.exact-match') },
    { id: MatchType.Phrase, label: t('label.phrase-match') },
    { id: MatchType.Fuzzy, label: t('label.fuzzy-match') },
    { id: MatchType.Standard, label: t('label.standard-match') },
  ];
  const highlightToggle = (
    <Toggle
      aria-label={t('label.highlight-field-plural')}
      data-testid="highlight-field-switch"
      isDisabled={!isHighlightAllowed}
      isSelected={isHighlightAllowed && isHighlighted}
      onChange={onToggleHighlight}
    />
  );

  return (
    <Card data-testid={`field-configuration-panel-${field.field}`} size="sm">
      <Card.Content>
        <Box direction="col" gap={3}>
          <Box align="center" direction="row" gap={2} justify="between">
            <Box align="center" className="tw:min-w-0" direction="row" gap={2}>
              <Typography
                className="tw:truncate"
                data-testid="field-name"
                size="text-sm"
                weight="semibold">
                {field.field}
              </Typography>
              {field.field.startsWith('extension.') && (
                <Badge
                  color="blue"
                  data-testid="custom-property-badge"
                  size="sm"
                  type="pill-color">
                  {t('label.custom')}
                </Badge>
              )}
            </Box>
            <Box align="center" direction="row" gap={1}>
              <Badge
                color="brand"
                data-testid="field-weight"
                size="sm"
                type="pill-color">
                {weight}
              </Badge>
              <ButtonUtility
                aria-expanded={isOpen}
                color="tertiary"
                data-testid="field-configuration-toggle"
                icon={isOpen ? ChevronUp : ChevronDown}
                size="xs"
                tooltip={t('label.edit')}
                onPress={() => setIsOpen((open) => !open)}
              />
              <ButtonUtility
                color="tertiary"
                data-testid="delete-search-field"
                icon={Trash01}
                size="xs"
                tooltip={t('label.delete')}
                onPress={onDelete}
              />
            </Box>
          </Box>
          <Typography className="tw:text-tertiary" size="text-xs">
            {description ?? t('label.no-description')}
          </Typography>

          {isOpen && (
            <Box
              className="tw:border-t tw:border-secondary tw:pt-3"
              direction="col"
              gap={4}>
              <Box align="center" direction="row" justify="between">
                <Typography size="text-sm">
                  {t('label.highlight-field-plural')}
                </Typography>
                {isHighlightAllowed ? (
                  highlightToggle
                ) : (
                  <Tooltip title={t('message.field-cannot-be-highlighted')}>
                    {highlightToggle}
                  </Tooltip>
                )}
              </Box>
              <Box direction="col" gap={1}>
                <Box align="center" direction="row" justify="between">
                  <Typography size="text-sm">{t('label.weight')}</Typography>
                  <Typography
                    className="tw:text-brand-secondary"
                    data-testid="field-weight-value"
                    size="text-sm"
                    weight="semibold">
                    {weight}
                  </Typography>
                </Box>
                <Slider
                  aria-label={t('label.weight')}
                  data-testid="field-weight-slider"
                  maxValue={MAX_BOOST}
                  minValue={0}
                  step={BOOST_STEP}
                  value={weight}
                  onChange={(value) =>
                    onChange({ boost: Array.isArray(value) ? value[0] : value })
                  }
                />
              </Box>
              <Box align="center" direction="row" gap={3} justify="between">
                <Typography size="text-sm">{t('label.match-type')}</Typography>
                <Select
                  aria-label={t('label.match-type')}
                  className="tw:w-44"
                  data-testid="match-type-select"
                  items={matchTypeItems}
                  size="sm"
                  value={field.matchType ?? MatchType.Standard}
                  onChange={(key) => onChange({ matchType: key as MatchType })}>
                  {(item) => <Select.Item id={item.id} label={item.label} />}
                </Select>
              </Box>
            </Box>
          )}
        </Box>
      </Card.Content>
    </Card>
  );
};

export default MatchingFieldCard;
