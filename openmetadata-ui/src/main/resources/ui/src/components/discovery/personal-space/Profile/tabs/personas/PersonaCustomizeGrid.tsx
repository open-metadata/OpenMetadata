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
import { getCustomizePageCategories } from '../../../../../../utils/Persona/PersonaUtils';
import { PERSONA_CATEGORY_ICONS } from './personaCategoryIcons';

interface PersonaCustomizeGridProps {
  onSelectCategory: (category: string) => void;
}

const PersonaCustomizeGrid = ({
  onSelectCategory,
}: PersonaCustomizeGridProps) => {
  const categories = useMemo(() => getCustomizePageCategories(), []);

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5"
      data-testid="persona-customize-grid">
      {categories.map((category) => {
        const Icon = PERSONA_CATEGORY_ICONS[category.key] ?? category.icon;
        const handler = onSelectCategory;

        return (
          <Card
            isClickable
            data-testid={`customize-card-${category.key}`}
            key={category.key}
            role="button"
            size="md"
            tabIndex={0}
            onClick={() => handler(category.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handler(category.key);
              }
            }}>
            <Card.Content>
              <Box align="start" direction="row" gap={4}>
                <Box
                  align="center"
                  className="tw:shrink-0 tw:rounded-lg tw:bg-secondary tw:h-10 tw:w-10"
                  justify="center">
                  {Icon && <Icon className="tw:size-6" />}
                </Box>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {category.label}
                  </Typography>
                  <Typography
                    className="tw:text-tertiary tw:line-clamp-2"
                    size="text-sm"
                    weight="regular">
                    {category.description}
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

export default PersonaCustomizeGrid;
