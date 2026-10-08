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

import { Box, Card, Typography } from '@openmetadata/ui-core-components';
import { useMemo } from 'react';
import { getEntityIconWithBg } from '../../../../../../../utils/Assets/AssetsUtils';
import { PageTypeToEntityTypeMap } from '../../../../../../../pages/CustomizeDetailsPage/CustomizeDetailPage.interface';
import { getCustomizePageOptions } from '../../../../../../../utils/Persona/PersonaUtils';

interface SubCategoryGridProps {
  baseCategory: string;
  onSelectEntity: (entityType: string) => void;
}

const SubCategoryGrid = ({
  baseCategory,
  onSelectEntity,
}: SubCategoryGridProps) => {
  const options = useMemo(
    () => getCustomizePageOptions(baseCategory),
    [baseCategory]
  );

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5"
      data-testid="persona-sub-category-grid">
      {options.map((option) => {
        // PageType keys are PascalCase; ENTITY_ICON_MAPPER uses EntityType (lowercase)
        const entityType =
          (PageTypeToEntityTypeMap as Record<string, string>)[option.key] ??
          option.key.toLowerCase();

        return (
          <Card
            isClickable
            data-testid={`sub-category-card-${option.key}`}
            key={option.key}
            role="button"
            size="md"
            tabIndex={0}
            onClick={() => onSelectEntity(option.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectEntity(option.key);
              }
            }}>
            <Card.Content>
              <Box align="start" direction="row" gap={4}>
                <Box className="tw:shrink-0">
                  {getEntityIconWithBg(
                    entityType,
                    { className: 'tw:h-10 tw:w-10 tw:rounded-lg' },
                    { size: 25 }
                  )}
                </Box>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {option.label}
                  </Typography>
                  <Typography
                    className="tw:text-tertiary tw:line-clamp-2"
                    size="text-sm"
                    weight="regular">
                    {option.description}
                  </Typography>
                </Box>
              </Box>
            </Card.Content>
          </Card>
        );
      })}
    </Box>
  );
};

export default SubCategoryGrid;
