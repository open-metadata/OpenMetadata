/*
 *  Copyright 2022 Collate.
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

import { lazy } from 'react';
import { useTranslation } from 'react-i18next';
import withSuspenseFallback from '../../components/AppRouter/withSuspenseFallback';
import DocumentTitle from '../../components/common/DocumentTitle/DocumentTitle';
import HomeLandingPage from '../../components/MyData/HomeLandingPage/HomeLandingPage';
import LimitWrapper from '../../hoc/LimitWrapper';
import { useFirstLoginWelcome } from '../../hooks/useFirstLoginWelcome';

const WelcomeScreen = withSuspenseFallback(
  lazy(
    () =>
      import('../../components/MyData/WelcomeScreen/WelcomeScreen.component')
  )
);

/**
 * Classic mode's home route.
 *
 * The page itself is {@link HomeLandingPage}, which both app modes render —
 * this wrapper only adds what is specific to classic: the first-login welcome
 * screen and the asset-limit banner. AI mode mounts the same component with its
 * own chrome instead.
 */
const MyDataPage = () => {
  const { t } = useTranslation();
  const { showWelcome, closeWelcome } = useFirstLoginWelcome();

  if (showWelcome) {
    return (
      <>
        <DocumentTitle title={t('label.my-data')} />
        <div className="tw:h-full tw:pb-1.5 tw:pl-3 tw:pr-1.5">
          <WelcomeScreen onClose={closeWelcome} />
        </div>
      </>
    );
  }

  // HomeLandingPage is laid out with the core PageLayout, which does not claim
  // the tab title the way PageLayoutV1 does — claimed here so classic's home
  // tab keeps the title it had, without imposing it on AI mode's chrome.
  return (
    <>
      <DocumentTitle title={t('label.my-data')} />
      {/* The same white panel AI mode's shell draws around routed pages
        (`assistant-content`): white in light, the canvas step in dark. Classic
        has no such shell, so without it the cards sit on the page ground. */}
      <div className="tw:h-full tw:pb-1.5 tw:pl-3 tw:pr-1.5">
        <div
          className="tw:h-full tw:overflow-hidden tw:rounded-2xl tw:bg-primary tw:dark:bg-canvas"
          data-testid="home-page-surface">
          <HomeLandingPage />
        </div>
      </div>
      {/* Mounted only for its data-asset limit fetch (it drives the limit
        banner). Kept out of layout: any box after the full-height panel pushed
        the classic shell past the viewport. */}
      <div className="tw:hidden">
        <LimitWrapper resource="dataAssets">
          <span />
        </LimitWrapper>
      </div>
    </>
  );
};

export default MyDataPage;
