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
import {
  Building01,
  GlossaryTerm,
} from '@openmetadata/ui-core-components/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { GovernanceView } from './Governance.types';

interface LandingCard {
  descriptionKey: string;
  icon: FC<{ className?: string }>;
  id: string;
  titleKey: string;
  view: GovernanceView;
}

const LANDING_CARDS: LandingCard[] = [
  {
    id: 'glossary-relations',
    icon: GlossaryTerm,
    titleKey: 'label.glossary-term-relation-plural',
    descriptionKey: 'message.glossary-term-relation-settings-description',
    view: { type: 'glossary-list' },
  },
  {
    id: 'intake-forms',
    icon: Building01,
    titleKey: 'label.intake-form-plural',
    descriptionKey: 'message.intake-form-plural-description',
    view: { type: 'intake-list' },
  },
];

interface GovernanceLandingProps {
  onNavigate: (view: GovernanceView) => void;
}

const GovernanceLanding: FC<GovernanceLandingProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:px-8 tw:pb-8"
      data-testid="governance-landing">
      {LANDING_CARDS.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            isClickable
            key={card.id}
            role="button"
            size="md"
            tabIndex={0}
            onClick={() => onNavigate(card.view)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onNavigate(card.view);
              }
            }}>
            <Card.Content>
              <Box
                align="start"
                data-testid={`governance-card-${card.id}`}
                direction="row"
                gap={4}>
                <Box
                  align="center"
                  className="tw:shrink-0 tw:rounded-lg tw:bg-secondary tw:h-10 tw:w-10"
                  justify="center">
                  <Icon className="tw:size-6 tw:text-secondary" />
                </Box>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t(card.titleKey)}
                  </Typography>
                  <Typography
                    className="tw:text-tertiary tw:line-clamp-2"
                    size="text-sm"
                    weight="regular">
                    {t(card.descriptionKey)}
                  </Typography>
                </Box>
              </Box>
            </Card.Content>
          </Card>
        );
      })}
    </div>
  );
};

export default GovernanceLanding;
