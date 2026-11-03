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
  ButtonUtility,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import { Search, XClose } from '@openmetadata/ui-core-components/icons';
import { KeyboardEvent, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildDataPickerGroups,
  DataPickerConcept,
} from '../../../../utils/governance/ontology/OntologyDataConceptPick.utils';

interface OntologyDataConceptPickerProps {
  readonly concepts: DataPickerConcept[];
  readonly recentIds: string[];
  /** Asset counts are only known once every cluster page has loaded. */
  readonly isCountPending: boolean;
  readonly onPick: (conceptId: string) => void;
  readonly onClose?: () => void;
}

const MOVE_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** The concept chooser of Data mode: recents, concepts with data by count, then the rest. */
const OntologyDataConceptPicker = ({
  concepts,
  recentIds,
  isCountPending,
  onPick,
  onClose,
}: OntologyDataConceptPickerProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const groups = useMemo(
    () => buildDataPickerGroups(concepts, recentIds, query),
    [concepts, recentIds, query]
  );
  const sections = [
    { key: 'recent', label: t('label.recent'), items: groups.recent },
    {
      key: 'with-data',
      label: t('label.ontology-data-with-linked'),
      items: groups.withData,
    },
    {
      key: 'without-data',
      label: t('label.ontology-data-without-linked'),
      items: groups.withoutData,
    },
  ].filter((section) => section.items.length > 0);
  const options = sections.flatMap((section) => section.items);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key in MOVE_KEYS && options.length > 0) {
      event.preventDefault();
      setActive(
        (current) =>
          (current + MOVE_KEYS[event.key] + options.length) % options.length
      );
    } else if (event.key === 'Enter' && options[active]) {
      event.preventDefault();
      onPick(options[active].id);
    } else if (event.key === 'Escape' && onClose) {
      event.stopPropagation();
      onClose();
    }
  };

  const describe = (concept: DataPickerConcept) => {
    if (isCountPending && concept.assetCount === undefined) {
      return '';
    }

    return concept.assetCount
      ? t('label.count-asset', { count: concept.assetCount })
      : t('label.no-data');
  };

  return (
    // The wrapper only listens for keys bubbling up from the input.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="tw:flex tw:w-full tw:flex-col tw:gap-2"
      data-testid="ontology-data-concept-picker"
      onKeyDown={handleKeyDown}>
      <Input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the picker opens on the user's own click, to be typed into
        autoFocus
        aria-activedescendant={
          options[active] ? `${listId}-${options[active].id}` : undefined
        }
        aria-controls={listId}
        aria-expanded="true"
        aria-label={t('label.find-concept')}
        icon={Search}
        inputDataTestId="ontology-data-concept-search"
        placeholder={`${t('label.find-concept')}…`}
        size="sm"
        value={query}
        onChange={setQuery}
      />
      <div
        aria-label={t('label.concept-plural')}
        className="tw:max-h-72 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:p-1"
        id={listId}
        role="listbox">
        {options.length === 0 ? (
          <Typography
            className="tw:px-3 tw:py-2"
            color="secondary"
            size="text-sm">
            {t('message.ontology-find-no-match')}
          </Typography>
        ) : null}
        {sections.flatMap((section) => [
          <Typography
            aria-hidden="true"
            className="tw:px-3 tw:pt-2 tw:pb-1 tw:uppercase"
            color="secondary"
            key={`caption-${section.key}`}
            role="presentation"
            size="text-xs"
            weight="semibold">
            {section.label}
          </Typography>,
          ...section.items.map((concept) => {
            const position = options.indexOf(concept);

            return (
              // Keyboard users act through the input; the option is a pointer shortcut.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                aria-selected={position === active}
                className={`tw:flex tw:cursor-pointer tw:items-center tw:justify-between tw:gap-3 tw:rounded-md tw:px-3 tw:py-2 ${
                  position === active
                    ? 'tw:bg-active'
                    : 'tw:hover:bg-primary_hover'
                }`}
                data-testid={`ontology-data-concept-option-${concept.id}`}
                id={`${listId}-${concept.id}`}
                key={concept.id}
                role="option"
                tabIndex={-1}
                onClick={() => onPick(concept.id)}
                onMouseDown={(event) => event.preventDefault()}>
                <Typography ellipsis size="text-sm" weight="medium">
                  {concept.name}
                </Typography>
                <Typography
                  className="tw:shrink-0"
                  color="secondary"
                  size="text-xs">
                  {describe(concept)}
                </Typography>
              </div>
            );
          }),
        ])}
      </div>
    </div>
  );
};

export default OntologyDataConceptPicker;

interface OntologyDataConceptChipProps {
  readonly name: string;
  readonly summary: string;
  readonly onChange: () => void;
  readonly onClear: () => void;
}

export const OntologyDataConceptChip = ({
  name,
  summary,
  onChange,
  onClear,
}: OntologyDataConceptChipProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:py-1 tw:pr-1 tw:pl-3"
      data-testid="ontology-data-concept-chip"
      gap={2}>
      <button
        className="tw:flex tw:min-w-0 tw:cursor-pointer tw:items-baseline tw:gap-2 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left"
        data-testid="ontology-data-concept-change"
        type="button"
        onClick={onChange}>
        <Typography ellipsis size="text-sm" weight="semibold">
          {name}
        </Typography>
        <Typography
          className="tw:shrink-0"
          color="secondary"
          data-testid="ontology-data-concept-summary"
          size="text-xs">
          {summary}
        </Typography>
      </button>
      <ButtonUtility
        color="tertiary"
        data-testid="ontology-data-concept-clear"
        icon={XClose}
        size="xs"
        tooltip={t('label.clear')}
        onClick={onClear}
      />
    </Box>
  );
};
