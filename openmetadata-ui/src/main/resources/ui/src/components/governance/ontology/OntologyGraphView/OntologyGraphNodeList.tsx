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
import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { OntologyNode } from '../../../OntologyExplorer/OntologyExplorer.interface';

interface OntologyGraphNodeListProps {
  readonly nodes: readonly OntologyNode[];
  readonly onOpen: (node: OntologyNode) => void;
  readonly selectedId?: string;
}

const PAGE_STEP = 10;

/**
 * The graph canvas has no focusable nodes, so this list is the keyboard route
 * to them: one Tab stop that stays out of sight until it has focus, then
 * arrow keys move through the concepts and Enter opens one. The options exist
 * only while it has focus, so they never compete with other lists of concepts
 * for a role query.
 */
const OntologyGraphNodeList = ({
  nodes,
  onOpen,
  selectedId,
}: OntologyGraphNodeListProps) => {
  const { t } = useTranslation();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const selected = nodes.findIndex(({ id }) => id === selectedId);
    setActive(selected >= 0 ? selected : 0);
  }, [nodes, selectedId]);

  useEffect(() => {
    if (isFocused) {
      document
        .getElementById(`${listId}-${active}`)
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [active, isFocused, listId]);

  const moveTo = (position: number) =>
    setActive(Math.min(nodes.length - 1, Math.max(0, position)));

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const steps: Record<string, () => void> = {
      ArrowDown: () => moveTo(active + 1),
      ArrowUp: () => moveTo(active - 1),
      End: () => moveTo(nodes.length - 1),
      Home: () => moveTo(0),
      PageDown: () => moveTo(active + PAGE_STEP),
      PageUp: () => moveTo(active - PAGE_STEP),
      Enter: () => nodes[active] && onOpen(nodes[active]),
    };
    if (event.key in steps) {
      event.preventDefault();
      steps[event.key]();
    }
  };

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div
      className={
        isFocused
          ? 'tw:absolute tw:left-3.5 tw:bottom-16 tw:z-20 tw:w-64 tw:rounded-lg tw:border tw:border-secondary tw:bg-surface tw:p-1 tw:shadow-lg'
          : 'tw:sr-only'
      }
      data-testid="ontology-graph-node-list">
      <p
        className="tw:m-0 tw:px-3 tw:py-1 tw:text-xs tw:text-tertiary"
        id={`${listId}-hint`}>
        {t('message.ontology-concept-list-hint')}
      </p>
      <div
        aria-activedescendant={`${listId}-${active}`}
        aria-describedby={`${listId}-hint`}
        aria-label={`${t('label.concept-plural')} (${nodes.length})`}
        className="tw:m-0 tw:max-h-60 tw:overflow-auto tw:p-0 tw:outline-none"
        ref={listRef}
        role="listbox"
        tabIndex={0}
        onBlur={() => setIsFocused(false)}
        onFocus={() => setIsFocused(true)}
        onKeyDown={handleKeyDown}>
        {(isFocused ? nodes : []).map((node, position) => (
          // The listbox owns the keyboard; options are a pointer shortcut.
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events
          <div
            aria-selected={node.id === selectedId}
            className={`tw:cursor-pointer tw:rounded-md tw:px-3 tw:py-1.5 tw:text-sm tw:text-primary ${
              position === active ? 'tw:bg-active' : ''
            }`}
            data-testid={`ontology-graph-node-option-${node.id}`}
            id={`${listId}-${position}`}
            key={node.id}
            role="option"
            tabIndex={-1}
            onClick={() => onOpen(node)}>
            {node.label}
          </div>
        ))}
      </div>
    </div>
  );
};

export default OntologyGraphNodeList;
