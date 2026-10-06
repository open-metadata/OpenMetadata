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

import { Button, Tabs, Typography } from '@openmetadata/ui-core-components';
import { ChevronDown } from '@openmetadata/ui-core-components/icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NeedsYouNowItem,
  NeedsYouNowKind,
  NEEDS_YOU_NOW_KINDS,
  NEEDS_YOU_NOW_KIND_ORDER,
} from './needsYouNow.types';
import NeedsYouNowItemCard from './NeedsYouNowItemCard';

const ALL_FILTER = 'all';
type NeedsYouNowFilter = NeedsYouNowKind | typeof ALL_FILTER;

// `sm` is the smallest tab size the design system ships, and it is a step larger
// than the mock. `Tab` merges a consumer className last through twMerge, so this
// drops it to the scale's smallest step without leaving the component.
const TAB_CLASSES = 'tw:px-3 tw:py-1.5 tw:text-xs';

// Enough to fill the fold; the rest is one click away rather than an endless
// scroll between the user and the sections below.
const INITIAL_VISIBLE_ITEMS = 5;

export interface NeedsYouNowSectionProps {
  items: NeedsYouNowItem[];
}

/**
 * Cross-domain "act on this first" inbox: approvals, service health and data
 * quality merged into one list ordered by impact and age.
 */
const NeedsYouNowSection: React.FC<NeedsYouNowSectionProps> = ({ items }) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<NeedsYouNowFilter>(ALL_FILTER);
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const handleResolve = (id: string) =>
    setResolvedIds((prev) => new Set(prev).add(id));

  const openItems = useMemo(
    () => items.filter((item) => !resolvedIds.has(item.id)),
    [items, resolvedIds]
  );

  // Counts are of the whole inbox, not the active filter — a tab has to show
  // what selecting it would reveal.
  const tabs = useMemo(() => {
    const countOf = (kind: NeedsYouNowKind) =>
      openItems.filter((item) => item.kind === kind).length;

    return [
      { id: ALL_FILTER, label: t('label.all'), badge: openItems.length },
      ...NEEDS_YOU_NOW_KIND_ORDER.map((kind) => ({
        id: kind,
        label: t(NEEDS_YOU_NOW_KINDS[kind].labelKey),
        badge: countOf(kind),
      })),
    ];
  }, [openItems, t]);

  const filteredItems = useMemo(
    () =>
      filter === ALL_FILTER
        ? openItems
        : openItems.filter((item) => item.kind === filter),
    [openItems, filter]
  );

  const visibleItems = showAll
    ? filteredItems
    : filteredItems.slice(0, INITIAL_VISIBLE_ITEMS);
  const hiddenCount = filteredItems.length - visibleItems.length;

  return (
    <section data-testid="needs-you-now">
      <div className="tw:flex tw:flex-wrap tw:items-center tw:justify-between tw:gap-4">
        <div className="tw:flex tw:items-baseline tw:gap-2.5">
          <Typography size="text-md" weight="semibold">
            {t('label.needs-you-now')}
          </Typography>
          {/* `!` on the colour: Typography renders `.prose`, whose unlayered
            `color` rule is emitted after the Tailwind utilities and would
            otherwise silently win. */}
          <Typography className="tw:text-text-tertiary!" size="text-xs">
            {t('message.ranked-by-impact-and-age')}
          </Typography>
        </div>

        <Tabs
          className="tw:w-auto tw:shrink-0"
          selectedKey={filter}
          onSelectionChange={(key) => {
            setFilter(key as NeedsYouNowFilter);
            setShowAll(false);
          }}>
          <Tabs.List
            aria-label={t('label.needs-you-now')}
            items={tabs}
            size="sm"
            type="button-border">
            {(tab) => (
              <Tabs.Item
                badge={tab.badge}
                className={TAB_CLASSES}
                label={tab.label}
              />
            )}
          </Tabs.List>
        </Tabs>
      </div>

      {filteredItems.length === 0 ? (
        <div
          className="tw:mt-4 tw:flex tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-secondary tw:bg-primary tw:p-8"
          data-testid="needs-you-now-empty">
          <Typography className="tw:text-text-secondary!">
            {t('message.no-data-available')}
          </Typography>
        </div>
      ) : (
        <>
          <ul
            className="tw:mt-4 tw:flex tw:flex-col tw:gap-2.5"
            data-testid="needs-you-now-list">
            {visibleItems.map((item) => (
              <NeedsYouNowItemCard
                item={item}
                key={item.id}
                onResolve={handleResolve}
              />
            ))}
          </ul>

          {hiddenCount > 0 && (
            <div className="tw:mt-4 tw:flex tw:justify-center">
              <Button
                className="tw:rounded-full tw:*:data-icon:size-4"
                color="secondary"
                data-testid="needs-you-now-show-more"
                iconLeading={ChevronDown}
                size="sm"
                onPress={() => setShowAll(true)}>
                {t('label.show-count-more', { count: hiddenCount })}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default NeedsYouNowSection;
