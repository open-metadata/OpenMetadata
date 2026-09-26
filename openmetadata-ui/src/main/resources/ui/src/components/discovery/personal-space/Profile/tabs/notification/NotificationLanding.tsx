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
  Card,
  Typography,
} from '@openmetadata/ui-core-components';
import { Bell01 } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { NotificationView } from './Notification.types';

interface NotificationLandingProps {
  onNavigate: (view: NotificationView) => void;
}

const NotificationLanding: FC<NotificationLandingProps> = ({ onNavigate }) => {
  const { t } = useTranslation();

  return (
    <Box
      className="tw:grid tw:grid-cols-1 tw:sm:grid-cols-2 tw:lg:grid-cols-3 tw:gap-5 tw:pt-2 tw:px-8 tw:pb-8"
      data-testid="notification-landing">
      <Card size="md">
        <Card.Content>
          <Button
            className="tw:w-full tw:text-left tw:no-underline"
            color="link-color"
            data-testid="notification-card-alerts"
            onPress={() => onNavigate({ type: 'list' })}>
            <Box align="start" direction="row" gap={4}>
              <Box
                align="center"
                className="tw:shrink-0 tw:rounded-lg tw:bg-secondary tw:h-10 tw:w-10"
                justify="center">
                <Bell01 className="tw:size-6 tw:text-secondary" />
              </Box>
              <Box className="tw:min-w-0" direction="col" gap={1}>
                <Typography
                  className="tw:text-primary"
                  size="text-sm"
                  weight="semibold">
                  {t('label.alert-plural')}
                </Typography>
                <Typography
                  className="tw:text-tertiary tw:line-clamp-2"
                  size="text-sm"
                  weight="regular">
                  {t('message.alerts-description')}
                </Typography>
              </Box>
            </Box>
          </Button>
        </Card.Content>
      </Card>
    </Box>
  );
};

export default NotificationLanding;
