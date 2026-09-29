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
  AppModeRoutesFallbackContribution,
  AppModeSlotContribution,
  EXTENSION_POINTS,
} from '../../../utils/ExtensionPointTypes';
import { useApplicationsProvider } from '../../Settings/Applications/ApplicationsProvider/ApplicationsProvider';

/**
 * Typed read helpers over the app-mode extension points.
 *
 * The shell consumes these; a plugin (e.g. Collate) contributes to the
 * same points via `extensionRegistry.contribute(...)` at boot. OSS core
 * never imports plugin code — every AI-exclusive surface arrives through
 * these named channels. Modules are the one exception: they arrive via
 * `AppPlugin.getModeModules(mode)` (see `sharedAppModules.ts`), not a
 * registry extension point — chrome (fallback/banners/overlays/sidebar
 * slots) still goes through the registry below.
 */

/**
 * Catch-all route contributions for `app-mode.routes.fallback`. The last
 * contribution wins (mounted at `path="*"`).
 */
export const useAppModeRoutesFallback = ():
  | AppModeRoutesFallbackContribution
  | undefined => {
  const { extensionRegistry } = useApplicationsProvider();
  const fallbacks =
    extensionRegistry.getContributions<AppModeRoutesFallbackContribution>(
      EXTENSION_POINTS.APP_MODE_ROUTES_FALLBACK
    );

  return fallbacks[fallbacks.length - 1];
};

/** Slot contributions for `app-mode.layout.banners`. */
export const useAppModeBanners = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_LAYOUT_BANNERS
  );
};

/** Slot contributions for `app-mode.layout.overlays`. */
export const useAppModeOverlays = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_LAYOUT_OVERLAYS
  );
};

/** Slot contributions for `app-mode.sidebar.header`. */
export const useAppModeSidebarHeader = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_SIDEBAR_HEADER
  );
};

/** Slot contributions for `app-mode.sidebar.mainFooter`. */
export const useAppModeSidebarMainFooter = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_SIDEBAR_MAIN_FOOTER
  );
};

/** Slot contributions for `app-mode.sidebar.railFooter`. */
export const useAppModeSidebarRailFooter = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_SIDEBAR_RAIL_FOOTER
  );
};

/**
 * Slot contributions for `app-mode.sidebar.recent` — the expanded-panel
 * recent-activity region (e.g. a plugin's recent-chats list) between the nav
 * and the footer.
 */
export const useAppModeSidebarRecent = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_SIDEBAR_RECENT
  );
};

/**
 * Slot contributions for `app-mode.sidebar.recentRail` — the collapsed-rail
 * counterpart of {@link useAppModeSidebarRecent} (e.g. a recent-chats
 * popover trigger).
 */
export const useAppModeSidebarRecentRail = (): AppModeSlotContribution[] => {
  const { extensionRegistry } = useApplicationsProvider();

  return extensionRegistry.getContributions<AppModeSlotContribution>(
    EXTENSION_POINTS.APP_MODE_SIDEBAR_RECENT_RAIL
  );
};
