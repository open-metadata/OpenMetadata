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
import { Input, Typography } from '@openmetadata/ui-core-components';
import { Search } from '@openmetadata/ui-core-components/icons';
import { KeyboardEvent, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from '../../../OntologyExplorer/OntologyExplorer.interface';

interface OntologyConceptSearchProps {
  readonly onChange: (value: string) => void;
  readonly onOpen: (node: OntologyNode) => void;
  readonly results: readonly OntologyNode[];
  readonly value: string;
}

const MOVE_KEYS: Record<string, number> = { ArrowDown: 1, ArrowUp: -1 };

/**
 * The Find box with the list of concepts it matched. Enter opens the
 * highlighted result (the first, until the arrow keys move it), Escape clears
 * the search while the list is open (a second Escape reaches the concept panel), and the rest of
 * the graph stays dimmed to the matches.
 */
const OntologyConceptSearch = ({
  onChange,
  onOpen,
  results,
  value,
}: OntologyConceptSearchProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const [active, setActive] = useState(0);
  const [openedFor, setOpenedFor] = useState<string>();
  const query = value.trim();
  const isListed = query.length > 0 && openedFor !== value;

  useEffect(() => {
    setActive(0);
  }, [value]);

  const open = (node: OntologyNode) => {
    setOpenedFor(value);
    onOpen(node);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && isListed && results[active]) {
      event.preventDefault();
      open(results[active]);
    } else if (event.key in MOVE_KEYS && isListed && results.length > 0) {
      event.preventDefault();
      setActive(
        (current) =>
          (current + MOVE_KEYS[event.key] + results.length) % results.length
      );
    } else if (event.key === 'Escape' && isListed) {
      event.stopPropagation();
      onChange('');
    }
  };

  return (
    // The wrapper only listens for keys bubbling up from the input.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="tw:relative tw:w-full" onKeyDown={handleKeyDown}>
      <Input
        aria-label={t('label.find-concept')}
        autoComplete="off"
        className="tw:w-full tw:min-w-36 tw:sm:w-54"
        icon={Search}
        inputDataTestId="ontology-graph-search"
        placeholder={`${t('label.find-concept')}…`}
        size="sm"
        value={value}
        onChange={onChange}
      />
      {isListed ? (
        <div
          aria-label={t('label.search-result-plural')}
          className="tw:absolute tw:top-full tw:left-0 tw:z-20 tw:mt-1 tw:max-h-72 tw:min-w-full tw:w-72 tw:overflow-auto tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:p-1 tw:shadow-lg"
          data-testid="ontology-graph-search-results"
          id={listId}
          role="listbox">
          {results.length === 0 ? (
            <div className="tw:px-3 tw:py-2" role="presentation">
              <Typography color="secondary" size="text-sm">
                {t('message.ontology-find-no-match')}
              </Typography>
            </div>
          ) : (
            results.map((node, position) => (
              // Keyboard users act through the input; the option is a pointer shortcut.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <div
                aria-selected={position === active}
                className={`tw:cursor-pointer tw:rounded-md tw:px-3 tw:py-2 tw:text-sm tw:text-primary ${
                  position === active
                    ? 'tw:bg-active'
                    : 'tw:hover:bg-primary_hover'
                }`}
                data-testid={`ontology-graph-search-result-${node.id}`}
                key={node.id}
                role="option"
                tabIndex={-1}
                onClick={() => open(node)}
                onMouseDown={(event) => event.preventDefault()}>
                {node.label}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
};

export default OntologyConceptSearch;
