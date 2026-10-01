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
  Badge,
  ButtonUtility,
  FeaturedIcon,
  Typography,
} from '@openmetadata/ui-core-components';
import { AlertTriangle, XClose } from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface SystemAlert {
  id: string;
  title: string;
  /** Severity chip beside the title, e.g. "Critical". */
  severity: string;
  description: string;
}

export interface SystemAlertBannerProps {
  alert: SystemAlert;
  onDismiss: () => void;
}

/**
 * Inverted platform-wide alert that opens the AI home — the "something is wrong
 * across the estate" banner, distinct from the per-widget incident callouts.
 */
const SystemAlertBanner: React.FC<SystemAlertBannerProps> = ({
  alert,
  onDismiss,
}) => {
  const { t } = useTranslation();

  return (
    <section
      // `bg-primary-solid` is the inverted surface token: near-black in light
      // mode, the dark secondary surface in dark mode — so the banner stays a
      // deliberate step darker than the page in both themes.
      className="tw:relative tw:flex tw:items-start tw:gap-4 tw:rounded-xl tw:bg-primary-solid tw:py-4.5 tw:pr-11 tw:pl-5"
      data-testid="system-alert-banner">
      <FeaturedIcon
        // The dark theme is square by default; the mock's badge is round.
        className="tw:shrink-0 tw:rounded-full! tw:before:rounded-full!"
        color="error"
        icon={AlertTriangle}
        size="lg"
        theme="dark"
      />
      <div className="tw:min-w-0">
        <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
          {/* `!` on every colour below: Typography renders `.prose`, whose
            unlayered `color` rule is emitted after the Tailwind utilities and
            would otherwise silently win. */}
          <Typography
            className="tw:text-pretty tw:text-primary_on-brand!"
            size="text-md"
            weight="semibold">
            {alert.title}
          </Typography>
          <Badge color="error" size="sm" type="pill-color">
            {alert.severity}
          </Badge>
        </div>
        <Typography
          className="tw:mt-1.5 tw:text-pretty tw:text-tertiary_on-brand!"
          size="text-sm">
          {alert.description}
        </Typography>
      </div>
      <ButtonUtility
        className="tw:absolute tw:top-3 tw:right-3 tw:size-7 tw:shrink-0 tw:rounded-lg tw:p-0 tw:*:data-icon:size-4"
        color="tertiary"
        data-testid="system-alert-dismiss"
        icon={
          <XClose
            className="tw:text-quaternary_on-brand!"
            height={15}
            width={15}
          />
        }
        size="xs"
        tooltip={t('label.close')}
        onClick={onDismiss}
      />
    </section>
  );
};

export default SystemAlertBanner;
