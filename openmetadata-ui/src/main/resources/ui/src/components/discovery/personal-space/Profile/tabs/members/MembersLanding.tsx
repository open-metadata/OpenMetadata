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
import { Users01 } from '@openmetadata/ui-core-components/icons';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { EXTENSION_POINTS } from '../../../../../../utils/extensionPoints';
import type { MembersSectionContribution } from '../../../../../../utils/ExtensionPointTypes';
import { useApplicationsProvider } from '../../../../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';
import { LANDING_CARDS } from './Members.constants';
import type { MembersLandingCard, MembersSubPanelProps } from './Members.types';

const MembersLanding: FC<MembersSubPanelProps> = ({ onNavigate }) => {
  const { t } = useTranslation();
  const { getContributions } = useApplicationsProvider();

  // Downstream builds (e.g. Collate) contribute extra Members sections; each
  // gets a card after the built-in four, routing to `#members/section/<key>`.
  const cards = useMemo<MembersLandingCard[]>(() => {
    const contributed = getContributions<MembersSectionContribution>(
      EXTENSION_POINTS.MEMBERS_LANDING_SECTIONS
    ).map<MembersLandingCard>((contribution) => ({
      id: contribution.key,
      icon: contribution.icon ?? Users01,
      titleKey: contribution.titleKey,
      descriptionKey: contribution.descriptionKey ?? '',
      view: { type: 'section', key: contribution.key },
    }));

    return [...LANDING_CARDS, ...contributed];
  }, [getContributions]);

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:px-8 tw:pb-8"
      data-testid="members-landing">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card
            isClickable
            key={card.id}
            size="md"
            onClick={() => onNavigate(card.view)}>
            <Card.Content>
              <Box
                align="start"
                data-testid={`members-card-${card.id}`}
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
                  {card.descriptionKey && (
                    <Typography
                      className="tw:text-tertiary tw:line-clamp-2"
                      size="text-sm"
                      weight="regular">
                      {t(card.descriptionKey)}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Card.Content>
          </Card>
        );
      })}
    </Box>
  );
};

export default MembersLanding;
