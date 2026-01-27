/*
 *  Copyright 2024 Collate.
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

import { Box, Card, CardContent } from '@mui/material';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ListingData } from '../shared/types';
import { useCellRenderer } from './useCellRenderer';

interface UseCardViewConfig<T> {
  listing: ListingData<T>;
  cardTemplate: (
    entity: T,
    renderCell: (entity: T, column: any) => React.ReactNode
  ) => React.ReactNode;
}

/**
 * Renders entities in card grid using consumer-defined templates
 *
 * @description
 * Provides flexible card view rendering where the consumer defines the exact
 * card layout structure. Uses the same cell renderers as table view for
 * complete consistency. Consumer provides card template function that
 * receives entity data and renderCell function.
 *
 * @param config.listing - Entity listing data (same as table)
 * @param config.cardTemplate - Function that defines card layout structure
 *
 * @example
 * ```typescript
 * const domainCardTemplate = (entity, renderCell) => (
 *   <>
 *     <Box>{renderCell(entity, nameColumn)}</Box>
 *     <Box sx={{ display: 'flex', gap: 2 }}>
 *       <Box sx={{ flex: 1 }}>{renderCell(entity, tagColumn)}</Box>
 *       <Box sx={{ flex: 1 }}>{renderCell(entity, domainTypeColumn)}</Box>
 *     </Box>
 *     <Box>{renderCell(entity, ownerColumn)}</Box>
 *   </>
 * );
 *
 * const { cardView } = useCardView({
 *   listing: domainListing,
 *   cardTemplate: domainCardTemplate
 * });
 * ```
 *
 * @stability Stable - Uses stable cell renderer
 * @complexity Low - Simple grid with consumer-defined content
 */
export const useCardView = <T extends { id: string }>({
  listing,
  cardTemplate,
}: UseCardViewConfig<T>) => {
  const { renderCell } = useCellRenderer({
    columns: listing.columns,
    renderers: listing.renderers,
    chipSize: 'small',
  });
  const { t } = useTranslation();

  const cardView = useMemo(
    () =>
      isEmpty(listing.entities) ? (
        <Box
          sx={{ textAlign: 'center', margin: '16px 24px', padding: '9px 0' }}>
          {t('server.no-records-found')}
        </Box>
      ) : (
        <Box
          data-testid="card-view-container"
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)', // Strict 3 columns
            gap: 4, // 16px spacing
            m: 6, // 24px margin
          }}>
          {listing.entities.map((entity) => (
            <Card
              data-testid="entity-card"
              elevation={0}
              key={entity.id}
              sx={{
                height: '100%',
                cursor: 'pointer',
                boxShadow: 'none',
                '& .MuiCardContent-root': {
                  padding: '20px !important',
                },
                '& .entity-avatar': {
                  width: '54px',
                  height: '54px',
                  borderRadius: '8px',
                  '& .MuiAvatar-img': {
                    width: '28px',
                    height: '28px',
                  },
                  '& svg': {
                    width: '28px',
                    height: '28px',
                  },
                },
              }}
              onClick={() => listing.actionHandlers?.onEntityClick?.(entity)}>
              <CardContent>{cardTemplate(entity, renderCell)}</CardContent>
            </Card>
          ))}
        </Box>
      ),
    [listing.entities, cardTemplate, renderCell, listing.actionHandlers]
  );

  return {
    cardView,
    renderCell, // Expose for custom templates
  };
};
