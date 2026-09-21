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
  EmptyPlaceholder,
  FeaturedIcon,
  PageLayout,
} from '@openmetadata/ui-core-components';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InboxIcon } from '../../../../assets/svg/ask-collate-nav-bar/inbox-header.svg';
import { useIsAiMode } from '../../../../hooks/useAppMode';

export interface InboxPageProps {
  /**
   * The inbox body: the Activity / Triage switcher and the active surface.
   * Optional so the shell can mount without it; a consumer contributes the
   * real surface.
   */
  content?: ReactNode;
}

/**
 * The routed shell for `/inbox`: a header and the inbox body.
 *
 * The inbox holds Activity and Triage, and those tabs live with the body that
 * owns their counts and shared date filter, so this shell contributes no tab
 * bar of its own. My Data is a separate surface, not an inbox tab.
 *
 * The brand-tinted "gradient" header is app-mode chrome — gated on
 * {@link useIsAiMode} so a classic mount renders the flat header.
 */
const InboxPage: React.FC<InboxPageProps> = ({ content }) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  return (
    <Box
      className="inbox-page tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:gap-4 tw:overflow-hidden tw:p-2"
      data-testid="inbox-page"
      direction="col">
      <PageLayout.PageHeader
        className="tw:mb-0! tw:pb-0"
        icon={
          <FeaturedIcon
            color="brand"
            icon={InboxIcon}
            shape="square"
            size="md"
            theme="dark"
          />
        }
        subtitle={t('message.inbox-desc')}
        title={t('label.inbox')}
        variant={isAiMode ? 'gradient' : 'flat'}
      />

      <Box
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-[10px] tw:bg-primary"
        direction="col">
        {content ?? (
          <EmptyPlaceholder
            data-testid="inbox-empty"
            title={t('label.no-data')}
            variant="blank"
          />
        )}
      </Box>
    </Box>
  );
};

export default InboxPage;
