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
  EmptyPlaceholder,
  FeaturedIcon,
  PageLayout,
} from '@openmetadata/ui-core-components';
import React, { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InboxIcon } from '../../../../assets/svg/ask-collate-nav-bar/inbox-header.svg';
import { useIsAiMode } from '../../../../hooks/useAppMode';

export interface InboxPageProps {
  /** The Activity / Triage tab strip, drawn along the header's bottom edge. */
  tabs?: ReactNode;
  /** The active tab's surface. */
  content?: ReactNode;
}

/**
 * The routed shell for `/inbox`: the standard app page — `PageLayout` with a
 * `PageLayout.PageHeader` carrying the Activity / Triage tabs, over
 * `PageLayout.Content` — so its frame, spacing and surfaces match the other
 * pages (Data Quality, Alerts, Connections). My Data is a separate surface,
 * not an inbox tab.
 *
 * The brand-tinted "gradient" header is app-mode chrome — gated on
 * {@link useIsAiMode} so a classic mount renders the flat header.
 */
const InboxPage: React.FC<InboxPageProps> = ({ tabs, content }) => {
  const { t } = useTranslation();
  const isAiMode = useIsAiMode();

  return (
    <PageLayout data-testid="inbox-page">
      <PageLayout.PageHeader
        className="tw:mb-0!"
        footer={tabs}
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

      <PageLayout.Content className="tw:flex tw:min-h-0 tw:flex-col tw:overflow-hidden! tw:px-2! tw:pt-0! tw:pb-0!">
        {content ?? (
          <EmptyPlaceholder
            data-testid="inbox-empty"
            title={t('label.no-data')}
            variant="blank"
          />
        )}
      </PageLayout.Content>
    </PageLayout>
  );
};

export default InboxPage;
