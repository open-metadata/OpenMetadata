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
import { Box, Button } from '@openmetadata/ui-core-components';
import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CollapsibleChipListProps<T> {
  items: T[];
  visibleCount: number;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  'data-testid'?: string;
}

/**
 * Wrapping chips that collapse to the first `visibleCount`, with a "+N more"
 * toggle that expands to every chip and a "Show less" toggle that collapses.
 */
export const CollapsibleChipList = <T,>({
  items,
  visibleCount,
  getKey,
  renderItem,
  'data-testid': dataTestId,
}: CollapsibleChipListProps<T>) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const hiddenCount = items.length - visibleCount;
  const visibleItems = isExpanded ? items : items.slice(0, visibleCount);

  return (
    <Box align="center" data-testid={dataTestId} gap={2} wrap="wrap">
      {visibleItems.map((item) => (
        <span className="tw:inline-flex tw:max-w-full" key={getKey(item)}>
          {renderItem(item)}
        </span>
      ))}
      {hiddenCount > 0 && (
        <Button
          aria-expanded={isExpanded}
          color="link-color"
          data-testid="toggle-collapsed-values"
          size="sm"
          onPress={() => setIsExpanded((expanded) => !expanded)}>
          {isExpanded
            ? t('label.show-less')
            : t('label.plus-count-more', { count: hiddenCount })}
        </Button>
      )}
    </Box>
  );
};
