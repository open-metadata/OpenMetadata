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
import { Button } from '@openmetadata/ui-core-components';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CollapsibleChipListProps<T> {
  items: T[];
  /** Upper bound on chips shown while collapsed. */
  visibleCount?: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  'data-testid'?: string;
}

/**
 * Chips that collapse to a single line: as many as fit, then a "+N more"
 * toggle on that same line. Expanding wraps every chip and grows only the
 * card that holds the list.
 */
export const CollapsibleChipList = <T,>({
  items,
  visibleCount = items.length,
  getKey,
  renderItem,
  'data-testid': dataTestId,
}: CollapsibleChipListProps<T>) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const maxCollapsed = Math.min(visibleCount, items.length);
  const [fitCount, setFitCount] = useState(maxCollapsed);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(([entry]) =>
      setContainerWidth(Math.round(entry.contentRect.width))
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Start from the most chips allowed whenever the room or the data changes;
  // the effect below then drops chips until the line stops wrapping.
  useLayoutEffect(() => {
    setFitCount(maxCollapsed);
  }, [maxCollapsed, containerWidth]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (isExpanded || !container || fitCount <= 1) {
      return;
    }
    const children = Array.from(container.children) as HTMLElement[];
    const firstTop = children[0]?.offsetTop ?? 0;
    if (children.some((child) => child.offsetTop > firstTop)) {
      setFitCount((count) => count - 1);
    }
  });

  const shownCount = isExpanded ? items.length : fitCount;
  const hiddenCount = items.length - fitCount;

  return (
    <div
      className="tw:flex tw:flex-wrap tw:items-center tw:gap-2"
      data-testid={dataTestId}
      ref={containerRef}>
      {items.slice(0, shownCount).map((item) => (
        <span
          className="tw:inline-flex tw:min-w-0 tw:max-w-full"
          key={getKey(item)}>
          {renderItem(item)}
        </span>
      ))}
      {hiddenCount > 0 && (
        <Button
          aria-expanded={isExpanded}
          className="tw:shrink-0"
          color="link-color"
          data-testid="toggle-collapsed-values"
          size="sm"
          onPress={() => setIsExpanded((expanded) => !expanded)}>
          {isExpanded
            ? t('label.show-less')
            : t('label.plus-count-more', { count: hiddenCount })}
        </Button>
      )}
    </div>
  );
};
