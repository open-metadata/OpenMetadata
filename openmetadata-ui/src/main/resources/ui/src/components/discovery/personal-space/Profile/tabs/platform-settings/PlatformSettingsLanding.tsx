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
import { useTranslation } from 'react-i18next';
import type {
  PlatformSettingsPage,
  PlatformSettingsView,
} from './PlatformSettings.types';

interface PlatformSettingsLandingProps {
  pages: PlatformSettingsPage[];
  onNavigate: (view: PlatformSettingsView) => void;
}

const PlatformSettingsLanding = ({
  pages,
  onNavigate,
}: PlatformSettingsLandingProps) => {
  const { t } = useTranslation();

  return (
    <div
      className="tw:grid tw:grid-cols-1 tw:gap-5 tw:sm:grid-cols-2 tw:lg:grid-cols-3"
      data-testid="platform-settings-landing">
      {pages.map((page) => {
        const Icon = page.icon;
        const open = () =>
          onNavigate({ type: 'page', page: page.id, isEditing: false });

        return (
          <Card
            isClickable
            data-testid={`platform-settings-card-${page.id}`}
            key={page.id}
            role="button"
            size="md"
            tabIndex={0}
            onClick={open}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open();
              }
            }}>
            <Card.Content>
              <Box align="start" direction="row" gap={4}>
                <Box
                  align="center"
                  className="tw:size-10 tw:shrink-0 tw:rounded-lg tw:bg-secondary"
                  justify="center">
                  <Icon className="tw:size-5 tw:text-secondary" />
                </Box>
                <Box className="tw:min-w-0" direction="col" gap={1}>
                  <Typography
                    className="tw:text-primary"
                    size="text-sm"
                    weight="semibold">
                    {t(page.titleKey)}
                  </Typography>
                  <Typography
                    className="tw:line-clamp-2 tw:text-tertiary"
                    size="text-sm">
                    {t(page.descriptionKey)}
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

export default PlatformSettingsLanding;
