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

import { PageLayout } from '@openmetadata/ui-core-components';
import { useQuery } from '@tanstack/react-query';
import classNames from 'classnames';
import type { ReactNode } from 'react';
import { lazy, useMemo } from 'react';
import type { ReactGridLayoutProps } from 'react-grid-layout';
import RGL, { WidthProvider } from 'react-grid-layout';
import { useNavigate } from 'react-router-dom';
import { PageType } from '../../../generated/system/ui/page';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import type { WidgetConfig } from '../../../interface/customization.interface';
import {
  docStoreQueryFn,
  docStoreQueryKey,
  personaDocFqn,
  PERSONA_DOC_STALE_TIME,
} from '../../../rest/queries/docStoreQuery';
import customizeMyDataPageClassBase from '../../../utils/CustomizeMyDataPageClassBase';
import {
  getMyDataWidgetBaseKey,
  normalizeLandingPageLayout,
} from '../../../utils/CustomizeMyDataPageWidgetUtils';
import { getPersonaPage } from '../../../utils/CustomizePage/PersonaPage.utils';
import { getCustomizePagePath } from '../../../utils/GlobalSettingsUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import DeferredWidget from '../../common/DeferredWidget/DeferredWidget.component';
import { TopicCollapseContext } from '../Widgets/Common/TopicWidget/TopicCollapseContext';
import AnnouncementsRail from './AnnouncementsRail';
import HomeLandingPageSkeleton from './HomeLandingPageSkeleton';
import TopicsSectionHeader from './TopicsSectionHeader';
import { useTopicsView } from './useTopicsView';

const LandingPageWidgetRenderer = withSuspenseFallback(
  lazy(() => import('../LandingPageWidgetRenderer/LandingPageWidgetRenderer'))
);

const ReactGridLayout = WidthProvider(RGL) as React.ComponentType<
  ReactGridLayoutProps & { children?: ReactNode }
>;

/**
 * The footer slot is positioned over the content, so the page has to reserve
 * its height — without it AI mode's prompt box and suggestion chips sit on top
 * of the last row of widgets. Module scope so the branch does not count against
 * the page's complexity budget.
 */
const contentClassName = (hasFooter: boolean) =>
  classNames(
    'tw:overflow-visible! tw:p-0!',
    hasFooter ? 'tw:pb-44!' : 'tw:pb-12!'
  );

export interface HomeLandingPageProps {
  /**
   * Pinned to the bottom of the page. AI mode mounts its prompt input here;
   * classic mode passes nothing, so the slot collapses.
   */
  footerSlot?: ReactNode;
}

/**
 * The persona's landing page as the grid renders it: the normalized widget
 * layout and whether it is still resolving.
 */
const usePersonaLandingPage = () => {
  const { currentUser, selectedPersona } = useApplicationStore();

  const personaFqn = personaDocFqn(selectedPersona);
  const { data: docData, isPending: isDocPending } = useQuery({
    queryKey: docStoreQueryKey(personaFqn ?? ''),
    queryFn: docStoreQueryFn(personaFqn ?? ''),
    enabled: !!personaFqn,
    retry: false,
    staleTime: PERSONA_DOC_STALE_TIME,
  });
  // The store resolves `selectedPersona` in the same write that sets the
  // user, so until the user is in, "no persona" is not an answer yet. Mounting
  // the default grid on that would fire every widget's queries, then tear the
  // grid down for the skeleton the moment the persona lands, and fire the
  // persona grid's queries on top.
  const isPersonaResolved = Boolean(currentUser?.id);
  const isLoading = !isPersonaResolved || (!!personaFqn && isDocPending);

  const layout = useMemo<WidgetConfig[]>(
    () =>
      normalizeLandingPageLayout(
        docData
          ? ((getPersonaPage(docData, PageType.LandingPage)?.layout ??
              []) as WidgetConfig[])
          : [],
        customizeMyDataPageClassBase.defaultLayout,
        customizeMyDataPageClassBase.getExcludedWidgetFqns(),
        customizeMyDataPageClassBase.landingPageMaxGridSize,
        customizeMyDataPageClassBase.getKnownWidgetKeyPrefixes()
      ),
    [docData]
  );

  return { isLoading, layout, selectedPersona };
};

/**
 * The home page, shared by both app modes.
 *
 * Fixed shell top to bottom — announcements rail, then the persona's widget
 * grid. Which widgets appear and where is entirely the persona's
 * landing-page layout (docStore), edited through `CustomizeMyData`; nothing
 * here is mode-specific. Widgets that have AI-only content decide that for
 * themselves.
 */
const HomeLandingPage = ({ footerSlot }: HomeLandingPageProps) => {
  const navigate = useNavigate();
  const { isLoading, layout, selectedPersona } = usePersonaLandingPage();

  const {
    collapseValue,
    columns,
    displayLayout,
    isEveryWidgetCollapsed,
    rowHeight,
    setViewMode,
    toggleAll,
    viewMode,
    widgetHeight,
  } = useTopicsView(layout);

  const widgets = useMemo(
    () =>
      displayLayout.map((widget) => (
        // The widget key is the handle every landing-page test reaches for.
        // The widgets used to carry it individually; now that they share one
        // shell it belongs on the cell that holds them. It is deliberately the
        // *base* key, not `widget.i`: a widget added through the picker carries
        // a `uniqueId` suffix that nothing outside the layout knows about.
        <div
          data-grid={widget}
          data-testid={getMyDataWidgetBaseKey(widget.i)}
          key={widget.i}>
          <DeferredWidget
            data-testid={`deferred-widget-${widget.i}`}
            minHeight={widgetHeight(widget.h)}>
            <LandingPageWidgetRenderer
              currentLayout={displayLayout}
              widgetConfig={widget}
            />
          </DeferredWidget>
        </div>
      )),
    [displayLayout]
  );

  const personaFqn = selectedPersona?.fullyQualifiedName;

  // react-grid-layout has known RTL issues; the grid wrapper is pinned to ltr.
  useGridLayoutDirection(isLoading);

  return (
    <div className="tw:relative tw:h-full tw:overflow-hidden">
      <PageLayout
        className="tw:p-0!"
        data-testid="home-landing-page"
        scroll="page">
        <PageLayout.Content className={contentClassName(Boolean(footerSlot))}>
          <div className="tw:flex tw:flex-col tw:gap-14 tw:px-4 tw:pt-8">
            <AnnouncementsRail />

            <section data-testid="topics-to-catch-up-on">
              <TopicsSectionHeader
                isEveryWidgetCollapsed={isEveryWidgetCollapsed}
                isToggleAllDisabled={layout.length === 0}
                viewMode={viewMode}
                onCustomize={
                  personaFqn
                    ? () =>
                        navigate(
                          getCustomizePagePath(personaFqn, PageType.LandingPage)
                        )
                    : undefined
                }
                onToggleAll={toggleAll}
                onViewModeChange={setViewMode}
              />

              {isLoading ? (
                <HomeLandingPageSkeleton />
              ) : (
                <TopicCollapseContext.Provider value={collapseValue}>
                  <div dir="ltr">
                    <ReactGridLayout
                      cols={columns}
                      containerPadding={[0, 0]}
                      isDraggable={false}
                      isResizable={false}
                      key={viewMode}
                      margin={[
                        customizeMyDataPageClassBase.landingPageWidgetMargin,
                        customizeMyDataPageClassBase.landingPageWidgetMargin,
                      ]}
                      rowHeight={rowHeight}>
                      {widgets}
                    </ReactGridLayout>
                  </div>
                </TopicCollapseContext.Provider>
              )}
            </section>
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
