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
  Skeleton,
  Typography,
} from '@openmetadata/ui-core-components';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import NoSearchResultsPlaceholder from '../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import SomethingWentWrongPlaceholder from '../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import { GlobalSearchListItem } from './GlobalSearch.types';
import { getListboxId, groupBySection } from './GlobalSearch.utils';
import GlobalSearchResultRow from './GlobalSearchResultRow';

/** Title/meta widths of the prototype's loading rows. */
const SKELETON_ROWS = [
  [180, 260],
  [150, 300],
  [210, 220],
  [240, 120],
  [200, 160],
];

export interface GlobalSearchResultListProps {
  items: GlobalSearchListItem[];
  query: string;
  activeKey?: string;
  previewId?: string;
  isFirstLoad: boolean;
  hasError: boolean;
  isEmpty: boolean;
  /** Opened from Recent Chat: the empty state names the type and offers a way out. */
  isScoped: boolean;
  /** Replaces the default no-results hint, e.g. to point at the query action. */
  emptyHintKey?: string;
  scopeLabel: string;
  /** Rendered on the section heading flagged `hasSort`. */
  sortControl?: ReactNode;
  onHover: (key: string) => void;
  onRetry: () => void;
  onSearchEverywhere: () => void;
}

const GlobalSearchResultList = ({
  items,
  query,
  activeKey,
  previewId,
  isFirstLoad,
  hasError,
  isEmpty,
  isScoped,
  emptyHintKey,
  scopeLabel,
  sortControl,
  onHover,
  onRetry,
  onSearchEverywhere,
}: GlobalSearchResultListProps) => {
  const { t } = useTranslation();

  if (isFirstLoad) {
    return (
      <Box aria-busy className="tw:px-5 tw:pt-3" direction="col" gap={4}>
        <Skeleton height={10} variant="rounded" width={64} />
        {SKELETON_ROWS.map(([titleWidth, metaWidth]) => (
          <Box align="center" gap={3} key={titleWidth}>
            <Skeleton height={32} variant="rounded" width={32} />
            <Box direction="col" gap={2}>
              <Skeleton height={12} variant="rounded" width={titleWidth} />
              <Skeleton height={10} variant="rounded" width={metaWidth} />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  if (hasError) {
    return (
      <Box className="tw:relative tw:h-80">
        <SomethingWentWrongPlaceholder
          description={t('message.global-search-error-description')}
          title={t('message.global-search-error-title')}
          onReload={onRetry}
        />
      </Box>
    );
  }

  if (isEmpty) {
    return (
      <Box className="tw:relative tw:h-80" data-testid="global-search-empty">
        <NoSearchResultsPlaceholder
          actions={
            isScoped
              ? [
                  {
                    key: 'search-everywhere',
                    label: t('label.search-everywhere'),
                    onClick: onSearchEverywhere,
                  },
                ]
              : undefined
          }
          description={t(
            emptyHintKey ?? 'message.global-search-no-result-hint'
          )}
          title={
            isScoped
              ? t('message.global-search-no-type-match', {
                  type: scopeLabel,
                  query,
                })
              : t('message.global-search-no-result', { query })
          }
        />
      </Box>
    );
  }

  return (
    <Box
      align="stretch"
      aria-label={t('label.result-plural')}
      className="tw:flex-none tw:pt-1.5"
      direction="col"
      role="region">
      {groupBySection(items).map(({ section, rows }) => {
        const listboxId = getListboxId(section?.key);
        const headingId = `${listboxId}-heading`;

        return (
          <Box direction="col" key={listboxId}>
            {/* The heading and its controls (sort, "See all") sit outside the
                listbox, which may hold only options. */}
            {section ? (
              <Box align="center" className="tw:mt-3 tw:px-5" justify="between">
                <Typography
                  color="quaternary"
                  id={headingId}
                  size="text-xs"
                  weight="medium">
                  {section.label}
                </Typography>
                {section.hasSort ? sortControl : null}
                {section.seeAll ? (
                  <Button
                    color="link-color"
                    size="sm"
                    onClick={section.seeAll.onPress}>
                    {section.seeAll.label}
                  </Button>
                ) : null}
              </Box>
            ) : null}
            <Box
              align="stretch"
              aria-labelledby={section ? headingId : undefined}
              direction="col"
              id={listboxId}
              role="listbox">
              {rows.map((item) => (
                <GlobalSearchResultRow
                  id={`global-search-option-${item.key}`}
                  isActive={activeKey === item.key}
                  isPreviewed={previewId === item.row.id}
                  key={item.key}
                  query={query}
                  row={item.row}
                  onHover={() => onHover(item.key)}
                  onRemove={item.onRemove}
                  onSelect={item.onSelect}
                />
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default GlobalSearchResultList;
