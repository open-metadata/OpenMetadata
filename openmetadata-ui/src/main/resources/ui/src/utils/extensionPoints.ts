/*
 *  Copyright 2025 Collate.
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

/**
 * Extension point ids, split out of `ExtensionPointTypes` so a consumer can
 * import the runtime constant without pulling in that module's type imports —
 * one of which reaches back into the Profile components, forming an import
 * cycle (`openmetadata-imports/no-circular-imports`).
 */
export const EXTENSION_POINTS = {
  // Service Details Page
  SERVICE_DETAILS_TABS: 'service-details.tabs',
  SERVICE_DETAILS_ACTIONS: 'service-details.actions',

  // Table Details Page
  TABLE_DETAILS_TABS: 'table-details.tabs',
  TABLE_HEADER_ACTIONS: 'table-header.actions',

  // Database Details Page
  DATABASE_DETAILS_TABS: 'database-details.tabs',

  // User Profile Page
  PROFILE_TABS: 'profile.tabs',

  // Notification settings landing — a downstream build contributes extra
  // sections (e.g. weekly emails, templates) that render inside the profile
  // Notification panel. OSS core shows only its built-in cards when nothing
  // is contributed; the cards themselves come from the global-settings menu
  // (see NotificationLanding), keyed by the settings option.
  NOTIFICATION_LANDING_SECTIONS: 'notification.landing-sections',

  // Members settings landing — a downstream build contributes extra sections
  // (e.g. SCIM provisioning) that render inside the profile Members panel as
  // their own view, with a card on the Members landing grid. OSS core shows
  // only its built-in cards when nothing is contributed.
  MEMBERS_LANDING_SECTIONS: 'members.landing-sections',

  // Team Details Page
  TEAM_DETAILS_TABS: 'team-details.tabs',

  // Global UI
  GLOBAL_FLOATING_BUTTONS: 'global.floating-buttons',

  // App Mode Shell (platform / ai-shell)
  // A plugin contributes AI-exclusive chrome through these points so OSS
  // core never imports plugin code. Read via the typed helpers in
  // `components/platform/ai-shell/appModeExtensions.ts`. Modules (nav +
  // owned routes) are NOT contributed here — AI is an app layout, so
  // its modules come from `LeftSidebarClassBase.getAppModeModules()` (a
  // downstream build overrides that), read via `sharedAppModules.ts`.
  APP_MODE_ROUTES_FALLBACK: 'app-mode.routes.fallback',
  APP_MODE_LAYOUT_BANNERS: 'app-mode.layout.banners',
  APP_MODE_LAYOUT_OVERLAYS: 'app-mode.layout.overlays',
  // Sidebar region slots — proprietary chrome (chat list, profile, inbox,
  // user menu) a plugin injects into the neutral shell sidebar.
  APP_MODE_SIDEBAR_HEADER: 'app-mode.sidebar.header',
  APP_MODE_SIDEBAR_MAIN_FOOTER: 'app-mode.sidebar.mainFooter',
  APP_MODE_SIDEBAR_RAIL_FOOTER: 'app-mode.sidebar.railFooter',
  // Recent-activity region between the nav and the footer — e.g. a plugin's
  // recent-chats list (expanded panel) and its collapsed-rail popover.
  APP_MODE_SIDEBAR_RECENT: 'app-mode.sidebar.recent',
  APP_MODE_SIDEBAR_RECENT_RAIL: 'app-mode.sidebar.recentRail',

  // Inbox task overview — a plugin contributes a task-type-specific detail
  // panel (e.g. a Data Access Request panel) that replaces the generic task
  // overview when its `condition(task)` matches. The core inbox renders the
  // generic overview standalone when nothing is contributed.
  INBOX_TASK_PANELS: 'inbox.task-panels',

  // Connections (integration domain) — page-level slots a plugin fills with
  // proprietary AI surfaces so OSS core never imports plugin code.
  CONNECTIONS_PAGE_FOOTER: 'connections.page.footer',
  SERVICE_DETAILS_FOOTER: 'service-details.footer',
  CONNECTIONS_LIST_ONBOARDING: 'connections.list.onboarding',
  CONNECTIONS_ROUTES: 'connections.routes',
} as const;
