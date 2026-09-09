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
  Tabs,
} from '@openmetadata/ui-core-components';
import React, { ReactNode, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactComponent as InboxIcon } from '../../../../assets/svg/ask-collate-nav-bar/inbox-header.svg';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import HeaderShell from '../../../common/HeaderShell/HeaderShell.component';
import { PERSONAL_SPACE_ROUTES } from '../personalSpace.constants';

type InboxPageTab = 'triage' | 'my-data';

const TAB_ROUTE: Record<InboxPageTab, string> = {
  triage: PERSONAL_SPACE_ROUTES.INBOX,
  'my-data': PERSONAL_SPACE_ROUTES.MY_DATA,
};

export interface InboxPageProps {
  /**
   * Body for the Triage tab (the Activity / Tasks feed). Optional so the shell
   * can mount without the feed; a consumer contributes the real surface.
   */
  triageContent?: ReactNode;
  /** Body for the My Data tab (the owned-data dashboard). */
  myDataContent?: ReactNode;
}

/**
 * The routed personal-space shell shared by `/inbox` (Triage) and `/my-data`
 * (My Data). Two top-level tabs whose active state is derived from the path so
 * each surface has its own URL. The brand-tinted "gradient" header is app-mode
 * chrome — gated on {@link useIsAiMode} so a classic mount renders the flat
 * header. The tab bodies are provided by the consumer; when absent the shell
 * renders a neutral placeholder.
 */
const InboxPage: React.FC<InboxPageProps> = ({
  triageContent,
  myDataContent,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isAiMode = useIsAiMode();
  const tab: InboxPageTab =
    pathname === PERSONAL_SPACE_ROUTES.MY_DATA ? 'my-data' : 'triage';

  const onTabChange = useCallback(
    (key: React.Key) => {
      navigate(TAB_ROUTE[key as InboxPageTab]);
    },
    [navigate]
  );

  const activeContent = tab === 'my-data' ? myDataContent : triageContent;

  return (
    <Box
      className="inbox-page tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:gap-4 tw:overflow-hidden tw:p-2"
      data-testid="inbox-page"
      direction="col">
      <HeaderShell
        className="tw:mb-0! tw:pb-0"
        footer={
          <Tabs
            className="tw:w-fit"
            selectedKey={tab}
            onSelectionChange={onTabChange}>
            <Tabs.List
              className="tw:mt-4 tw:gap-6 tw:before:hidden"
              size="sm"
              type="underline">
              <Tabs.Item id="triage" label={t('label.triage')} />
              <Tabs.Item id="my-data" label={t('label.my-data')} />
            </Tabs.List>
          </Tabs>
        }
        leading={
          <FeaturedIcon
            color="brand"
            icon={InboxIcon}
            shape="square"
            size="md"
            theme="dark"
          />
        }
        padding="comfortable"
        subtitle={t('message.inbox-desc')}
        title={t('label.inbox')}
        variant={isAiMode ? 'gradient' : 'flat'}
      />

      <Box
        className="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:rounded-[10px] tw:bg-primary"
        direction="col">
        {activeContent ?? (
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
