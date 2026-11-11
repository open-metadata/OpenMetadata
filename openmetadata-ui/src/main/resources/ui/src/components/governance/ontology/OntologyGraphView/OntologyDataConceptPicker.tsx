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
  ButtonUtility,
  Input,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  Check,
  ChevronDown,
  Plus,
  Search,
  XClose,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import {
  KeyboardEvent,
  RefObject,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  buildDataPickerGroups,
  DataPickerConcept,
} from '../../../../utils/governance/ontology/OntologyDataConceptPick.utils';

export type DataPickerOption = DataPickerConcept & {
  /** The first superclass, shown beside the name to tell same-named concepts apart. */
  parentName?: string;
};

interface OntologyDataConceptPickerProps {
  readonly concepts: DataPickerOption[];
  readonly recentIds: string[];
  /** Asset counts are only known once every cluster page has loaded. */
  readonly isCountPending: boolean;
  readonly selectedId?: string;
  readonly onPick: (conceptId: string) => void;
  readonly onClose?: () => void;
  /** Offered as a pinned row when the person may link data to the selected concept. */
  readonly onLinkData?: () => void;
}

const MOVE_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** The concept chooser of Data mode: recents, concepts with data by count, then the rest. */
const OntologyDataConceptPicker = ({
  concepts,
  recentIds,
  isCountPending,
  selectedId,
  onPick,
  onClose,
  onLinkData,
}: OntologyDataConceptPickerProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const groups = useMemo(
    () => buildDataPickerGroups(concepts, recentIds, query),
    [concepts, recentIds, query]
  );
  const parentById = useMemo(
    () => new Map(concepts.map((item) => [item.id, item.parentName])),
    [concepts]
  );
  const selectedName = concepts.find((item) => item.id === selectedId)?.name;
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

  const renderOption = (concept: DataPickerConcept, position: number) => {
    const hasData = (concept.assetCount ?? 0) > 0;
    const parentName = parentById.get(concept.id);

    return (
      // Keyboard users act through the input; the option is a pointer shortcut.
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <div
        aria-selected={position === active}
        className={classNames(
          'tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-md tw:px-3 tw:py-2',
          position === active ? 'tw:bg-active' : 'tw:hover:bg-primary_hover'
        )}
        data-testid={`ontology-data-concept-option-${concept.id}`}
        id={`${listId}-${concept.id}`}
        key={concept.id}
        role="option"
        tabIndex={-1}
        onClick={() => onPick(concept.id)}
        onMouseDown={(event) => event.preventDefault()}>
        <span
          aria-hidden="true"
          className={classNames(
            'tw:size-1.5 tw:shrink-0 tw:rounded-full',
            hasData ? 'tw:bg-utility-blue-500' : 'tw:bg-quaternary'
          )}
        />
        <Typography
          ellipsis
          className={hasData ? 'tw:text-primary' : 'tw:text-tertiary'}
          size="text-sm"
          weight="semibold">
          {concept.name}
        </Typography>
        {parentName ? (
          <Typography ellipsis color="secondary" size="text-xs">
            {parentName}
          </Typography>
        ) : null}
        <Typography
          className="tw:ml-auto tw:shrink-0"
          color="secondary"
          size="text-xs">
          {describe(concept)}
        </Typography>
        {concept.id === selectedId ? (
          <Check
            aria-hidden="true"
            className="tw:size-4 tw:shrink-0 tw:text-fg-brand-primary"
          />
        ) : null}
      </div>
    );
  };

  return (
    // The wrapper only listens for keys bubbling up from the input.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="tw:flex tw:w-full tw:flex-col"
      data-testid="ontology-data-concept-picker"
      onKeyDown={handleKeyDown}>
      <div className="tw:border-b tw:border-secondary tw:p-2">
        <Input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the user's own click, to type into
          autoFocus
          aria-activedescendant={
            options[active] ? `${listId}-${options[active].id}` : undefined
          }
          aria-controls={listId}
          aria-expanded="true"
          aria-label={t('label.find-concept')}
          autoComplete="off"
          icon={Search}
          inputDataTestId="ontology-data-concept-search"
          placeholder={`${t('label.find-concept')}…`}
          size="sm"
          value={query}
          onChange={setQuery}
        />
      </div>
      <div
        aria-label={t('label.concept-plural')}
        className="tw:max-h-72 tw:overflow-auto tw:p-1"
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
        {sections.flatMap((section, index) => [
          <Typography
            aria-hidden="true"
            className={classNames(
              'tw:px-3 tw:pt-2 tw:pb-1',
              index > 0 && 'tw:mt-1 tw:border-t tw:border-secondary'
            )}
            color="secondary"
            key={`caption-${section.key}`}
            role="presentation"
            size="text-xs"
            weight="medium">
            {section.label}
          </Typography>,
          ...section.items.map((concept) =>
            renderOption(concept, options.indexOf(concept))
          ),
        ])}
      </div>
      {onLinkData && selectedName ? (
        <div className="tw:border-t tw:border-secondary tw:p-1">
          <Button
            className="tw:w-full tw:justify-start"
            color="link-color"
            data-testid="ontology-data-concept-link-data"
            iconLeading={Plus}
            size="sm"
            onPress={onLinkData}>
            {t('label.link-data-to-entity', { entity: selectedName })}
          </Button>
        </div>
      ) : null}
      <Box
        aria-hidden="true"
        className="tw:border-t tw:border-secondary tw:px-3 tw:py-2"
        gap={4}>
        <Typography color="secondary" size="text-xs">
          {t('label.ontology-key-move')}
        </Typography>
        <Typography color="secondary" size="text-xs">
          {t('label.ontology-key-select')}
        </Typography>
        <Typography color="secondary" size="text-xs">
          {t('label.ontology-key-close')}
        </Typography>
      </Box>
    </div>
  );
};

export default OntologyDataConceptPicker;

interface OntologyDataConceptChipProps {
  readonly name: string;
  readonly summary: string;
  readonly isOpen: boolean;
  readonly triggerRef: RefObject<HTMLButtonElement>;
  readonly onChange: () => void;
  readonly onClear: () => void;
}

export const OntologyDataConceptChip = ({
  name,
  summary,
  isOpen,
  triggerRef,
  onChange,
  onClear,
}: OntologyDataConceptChipProps) => {
  const { t } = useTranslation();

  return (
    <Box
      align="center"
      className="tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:py-1 tw:pr-1 tw:pl-3 tw:shadow-xs"
      data-testid="ontology-data-concept-chip"
      gap={2}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="tw:flex tw:min-w-0 tw:cursor-pointer tw:items-center tw:gap-2 tw:border-0 tw:bg-transparent tw:p-0 tw:text-left"
        data-testid="ontology-data-concept-change"
        ref={triggerRef}
        type="button"
        onClick={onChange}>
        <span
          aria-hidden="true"
          className="tw:size-2 tw:shrink-0 tw:rounded-full tw:bg-utility-blue-500"
        />
        <Typography ellipsis size="text-sm" weight="semibold">
          {name}
        </Typography>
        <ChevronDown
          aria-hidden="true"
          className="tw:size-4 tw:shrink-0 tw:text-fg-quaternary"
        />
        <Typography
          className="tw:shrink-0"
          color="secondary"
          data-testid="ontology-data-concept-summary"
          size="text-xs">
          {`· ${summary}`}
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
