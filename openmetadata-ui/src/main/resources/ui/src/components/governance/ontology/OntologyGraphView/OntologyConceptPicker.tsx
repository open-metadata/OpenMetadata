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
  Button,
  Input,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import { ChevronDown, Search } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import {
  KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { matchConcepts, PickerConcept } from './OntologyConceptPicker.utils';

interface OntologyConceptPickerProps {
  readonly concepts: readonly PickerConcept[];
  /** The trigger's text: the concept in focus, or a prompt when none is. */
  readonly label?: string;
  readonly onPick: (conceptId: string) => void;
}

const ROWS_PER_PAGE = 20;
const MOVE_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/** Picks one concept of a graph too large to draw, styled like the header's ontology picker. */
const OntologyConceptPicker = ({
  concepts,
  label,
  onPick,
}: OntologyConceptPickerProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(ROWS_PER_PAGE);
  const [active, setActive] = useState(0);
  const matches = useMemo(
    () => matchConcepts(concepts, query),
    [concepts, query]
  );
  const visible = matches.slice(0, shown);
  const searchRef = useRef<HTMLInputElement>(null);

  // The popover focuses its own frame; the search field is where picking starts.
  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => searchRef.current?.focus());

      return () => cancelAnimationFrame(frame);
    }

    return undefined;
  }, [isOpen]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    setQuery('');
    setShown(ROWS_PER_PAGE);
    setActive(0);
  };
  const pick = (conceptId: string) => {
    handleOpenChange(false);
    onPick(conceptId);
  };
  const search = (value: string) => {
    setQuery(value);
    setShown(ROWS_PER_PAGE);
    setActive(0);
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key in MOVE_KEYS && visible.length > 0) {
      event.preventDefault();
      setActive(
        (current) =>
          (current + MOVE_KEYS[event.key] + visible.length) % visible.length
      );
    } else if (event.key === 'Enter' && visible[active]) {
      event.preventDefault();
      pick(visible[active].id);
    }
  };

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Button
        ellipsis
        className="tw:max-w-60"
        color="secondary"
        data-testid="ontology-graph-concept-picker"
        iconTrailing={ChevronDown}
        size="sm">
        {label ?? t('label.select-entity', { entity: t('label.concept') })}
      </Button>
      <Popover
        aria-label={t('label.concept-plural')}
        className="tw:w-80"
        placement="bottom">
        {/* The wrapper only listens for keys bubbling up from the search field. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className="tw:flex tw:max-h-80 tw:flex-col tw:py-2"
          onKeyDown={handleKeyDown}>
          <div className="tw:px-3 tw:pb-2">
            <Input
              aria-activedescendant={
                visible[active] ? `${listId}-${visible[active].id}` : undefined
              }
              aria-controls={listId}
              aria-label={t('label.search-concepts')}
              autoComplete="off"
              icon={Search}
              inputDataTestId="ontology-graph-concept-picker-search"
              placeholder={t('label.search-concepts')}
              ref={searchRef}
              size="sm"
              value={query}
              onChange={search}
            />
          </div>
          <div
            aria-label={t('label.concept-plural')}
            className="tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:px-1"
            id={listId}
            role="listbox">
            {visible.map((concept, position) => (
              // Keyboard users act through the search field; the option is a pointer shortcut.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                aria-selected={position === active}
                className={classNames(
                  'tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-md tw:px-3 tw:py-2',
                  position === active
                    ? 'tw:bg-active'
                    : 'tw:hover:bg-primary_hover'
                )}
                data-testid={`ontology-graph-concept-option-${concept.id}`}
                id={`${listId}-${concept.id}`}
                key={concept.id}
                role="option"
                tabIndex={-1}
                onClick={() => pick(concept.id)}
                onMouseDown={(event) => event.preventDefault()}>
                <Typography ellipsis size="text-sm" weight="medium">
                  {concept.name}
                </Typography>
                {concept.parentName ? (
                  <Typography
                    ellipsis
                    className="tw:ml-auto tw:shrink-0"
                    color="secondary"
                    size="text-xs">
                    {concept.parentName}
                  </Typography>
                ) : null}
              </div>
            ))}
            {matches.length === 0 ? (
              <div className="tw:px-3 tw:py-2" role="presentation">
                <Typography color="secondary" size="text-sm">
                  {t('message.ontology-find-no-match')}
                </Typography>
              </div>
            ) : null}
          </div>
          {matches.length > shown ? (
            <div className="tw:px-1 tw:pt-1">
              <Button
                className="tw:w-full"
                color="secondary"
                data-testid="ontology-graph-concept-picker-more"
                size="sm"
                onPress={() => setShown((count) => count + ROWS_PER_PAGE)}>
                {t('label.show-more-count', {
                  shown: visible.length,
                  total: matches.length,
                })}
              </Button>
            </div>
          ) : null}
        </div>
      </Popover>
    </PopoverTrigger>
  );
};

export default OntologyConceptPicker;
