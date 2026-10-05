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

import { Button, PageLayout } from '@openmetadata/ui-core-components';
import { Settings01 } from '@openmetadata/ui-core-components/icons';
import { useQuery } from '@tanstack/react-query';
import { isEmpty, startCase } from 'lodash';
import type { ReactNode } from 'react';
import { lazy, useMemo, useState } from 'react';
import type { ReactGridLayoutProps } from 'react-grid-layout';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageType } from '../../../generated/system/ui/page';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import {
  docStoreQueryFn,
  docStoreQueryKey,
  PERSONA_DOC_STALE_TIME,
  personaDocFqn,
} from '../../../rest/queries/docStoreQuery';
import {
  getConstrainedWidgetWidth,
  reflowLayoutToGrid,
} from '../../../utils/CustomizableLandingPagePureUtils';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import { isKnownMyDataWidgetKey } from '../../../utils/CustomizeMyDataPageWidgetUtils';
import { getPersonaPage } from '../../../utils/CustomizePage/PersonaPage.utils';
import { getCustomizePagePath } from '../../../utils/GlobalSettingsUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import type { WidgetConfig } from '../../../interface/customization.interface';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import DeferredWidget from '../../common/DeferredWidget/DeferredWidget.component';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import HomeLandingPageSkeleton from './HomeLandingPageSkeleton';
import AnnouncementsRail from './AnnouncementsRail';
import NeedsYouNowSection from './NeedsYouNow/NeedsYouNowSection';
import {
  PLACEHOLDER_NEEDS_YOU_NOW,
  PLACEHOLDER_SYSTEM_ALERT,
} from './NeedsYouNow/needsYouNowPlaceholderData';
import SystemAlertBanner from './SystemAlertBanner';

const LandingPageWidgetRenderer = withSuspenseFallback(
  lazy(() => import('../LandingPageWidgetRenderer/LandingPageWidgetRenderer'))
);

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: ReactNode }
>;

export interface HomeLandingPageProps {
  /**
   * Pinned to the bottom of the page. AI mode mounts its prompt input here;
   * classic mode passes nothing, so the slot collapses.
   */
  footerSlot?: ReactNode;
}

/**
 * The home page, shared by both app modes.
 *
 * Fixed shell top to bottom — standing alert, announcements rail, the
 * "needs you now" inbox — then the persona's widget grid. Which widgets appear
 * and where is entirely the persona's landing-page layout (docStore), edited
 * through `CustomizeMyData`; nothing here is mode-specific. Widgets that have
 * AI-only content decide that for themselves.
 */
const HomeLandingPage = ({ footerSlot }: HomeLandingPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, selectedPersona } = useApplicationStore();
  const [isSystemAlertDismissed, setIsSystemAlertDismissed] = useState(false);

  const personaFqn = personaDocFqn(selectedPersona);
  const { data: docData, isPending: isDocPending } = useQuery({
    queryKey: docStoreQueryKey(personaFqn ?? ''),
    queryFn: docStoreQueryFn(personaFqn ?? ''),
    enabled: !!personaFqn,
    retry: false,
    staleTime: PERSONA_DOC_STALE_TIME,
  });
  const isLoading = !!personaFqn && isDocPending;

  const layout = useMemo<WidgetConfig[]>(() => {
    const customized = docData
      ? ((getPersonaPage(docData, PageType.LandingPage)?.layout ??
          []) as WidgetConfig[])
      : [];

    // A saved layout may name widgets that have since been retired or excluded.
    // The renderer answers with a render-nothing component for those, which
    // would leave a hole in the grid, so drop the entries here instead.
    const excluded = customizeMyDataPageClassBase.getExcludedWidgetFqns();
    const isRenderable = (widget: WidgetConfig) =>
      isKnownMyDataWidgetKey(widget.i) &&
      !excluded.some((fqn) => widget.i.startsWith(fqn));

    const filtered = customized
      .filter(isRenderable)
      .map((widget) => ({ ...widget, w: getConstrainedWidgetWidth(widget.w) }));

    return isEmpty(filtered)
      ? customizeMyDataPageClassBase.defaultLayout
      : // A layout saved against a wider grid keeps its `x`, so widgets beyond
        // the current last column would be pushed onto rows of their own and
        // strand the space they vacated.
        reflowLayoutToGrid(
          filtered,
          customizeMyDataPageClassBase.landingPageMaxGridSize
        );
  }, [docData]);

  const widgets = useMemo(
    () =>
      layout.map((widget) => (
        <div data-grid={widget} key={widget.i}>
          <DeferredWidget
            data-testid={`deferred-widget-${widget.i}`}
            minHeight={
              widget.h * customizeMyDataPageClassBase.landingPageRowHeight
            }>
            <LandingPageWidgetRenderer
              currentLayout={layout}
              widgetConfig={widget}
            />
          </DeferredWidget>
        </div>
      )),
    [layout]
  );

  const displayName = getEntityName(currentUser);
  const greeting = t('message.hi-user', {
    user: displayName ? startCase(displayName) : t('label.user'),
  });

  // react-grid-layout has known RTL issues; the grid wrapper is pinned to ltr.
  useGridLayoutDirection(isLoading);

  return (
    <div className="tw:relative tw:h-full tw:overflow-hidden">
      <PageLayout className="tw:p-0!" scroll="page">
        {isSystemAlertDismissed ? (
          <PageLayout.PageHeader
            actions={
              selectedPersona?.fullyQualifiedName ? (
                <Button
                  color="secondary"
                  data-testid="customize-home-page"
                  iconLeading={Settings01}
                  size="sm"
                  onPress={() =>
                    navigate(
                      getCustomizePagePath(
                        selectedPersona.fullyQualifiedName as string,
                        PageType.LandingPage
                      )
                    )
                  }>
                  {t('label.customize')}
                </Button>
              ) : undefined
            }
            className="tw:m-2 tw:mb-0! tw:border-0"
            density="comfortable"
            icon={
              currentUser?.name ? (
                <ProfilePicture
                  displayName={displayName}
                  name={currentUser.name}
                  width="42"
                />
              ) : null
            }
            subtitle={t('message.home-landing-page-subtitle')}
            title={greeting}
            variant="gradient"
          />
        ) : (
          <PageLayout.Header className="tw:p-2 tw:pb-0">
            <SystemAlertBanner
              alert={PLACEHOLDER_SYSTEM_ALERT}
              onDismiss={() => setIsSystemAlertDismissed(true)}
            />
          </PageLayout.Header>
        )}

        <PageLayout.Content className="tw:overflow-visible! tw:p-0! tw:pb-12!">
          <div className="tw:flex tw:flex-col tw:gap-14 tw:px-4 tw:pt-8">
            <AnnouncementsRail />
            <NeedsYouNowSection items={PLACEHOLDER_NEEDS_YOU_NOW} />

            {isLoading ? (
              <HomeLandingPageSkeleton />
            ) : (
              <div dir="ltr">
                <ReactGridLayout
                  cols={customizeMyDataPageClassBase.landingPageMaxGridSize}
                  containerPadding={[0, 0]}
                  isDraggable={false}
                  isResizable={false}
                  margin={[
                    customizeMyDataPageClassBase.landingPageWidgetMargin,
                    customizeMyDataPageClassBase.landingPageWidgetMargin,
                  ]}
                  rowHeight={customizeMyDataPageClassBase.landingPageRowHeight}>
                  {widgets}
                </ReactGridLayout>
              </div>
            )}
          </div>
        </PageLayout.Content>
      </PageLayout>

      {footerSlot && (
        <div className="tw:absolute tw:bottom-0 tw:left-0 tw:right-0 tw:z-10 tw:overflow-hidden tw:rounded-b-card">
          {footerSlot}
        </div>
      )}
    </div>
  );
};

export default HomeLandingPage;
