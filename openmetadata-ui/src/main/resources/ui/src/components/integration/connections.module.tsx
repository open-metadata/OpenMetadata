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

import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { ReactComponent as ConnectionsActiveIcon } from '../../assets/svg/ask-collate-nav-bar/connections-active.svg';
import { ReactComponent as ConnectorsIcon } from '../../assets/svg/ask-collate-nav-bar/connections-default.svg';
import { ROUTES } from '../../constants/constants';
import { ExtensionPointRegistry } from '../../utils/ExtensionPointRegistry';
import {
  EXTENSION_POINTS,
  RouteContribution,
} from '../../utils/ExtensionPointTypes';
import i18n from '../../utils/i18next/LocalUtil';
import withSuspenseFallback from '../AppRouter/withSuspenseFallback';
import { AppModule } from '../platform/ai-shell/AppModule.types';
import { PluginRouteProps, RoutePosition } from '../Settings/Applications/plugins/AppPlugin';
import { CONNECTIONS_ROUTES } from './connections.constants';

type ClassicServiceAction =
  | 'add-ingestion'
  | 'edit-connection'
  | 'edit-ingestion';

type ClassicServiceRouteParams = Record<string, string | undefined> & {
  fqn?: string;
  ingestionFQN?: string;
  ingestionType?: string;
  serviceCategory?: string;
  tab?: string;
};

const encodeRouteParam = (value = '') => encodeURIComponent(value);

const getConnectionsPath = (...segments: Array<string | undefined>) =>
  `/${['connections', ...segments].map(encodeRouteParam).join('/')}`;

const getConnectionsServiceBase = (serviceCategory?: string, fqn?: string) =>
  getConnectionsPath(serviceCategory, fqn);

const getClassicServiceActionTarget = (
  action: ClassicServiceAction,
  {
    fqn,
    ingestionFQN,
    ingestionType,
    serviceCategory,
  }: ClassicServiceRouteParams
): string => {
  const serviceBase = getConnectionsServiceBase(serviceCategory, fqn);

  switch (action) {
    case 'edit-connection':
      return `${serviceBase}/edit-connection`;
    case 'add-ingestion':
      return getConnectionsPath(
        'service',
        serviceCategory,
        fqn,
        'add-ingestion',
        ingestionType
      );
    case 'edit-ingestion':
      return getConnectionsPath(
        'service',
        serviceCategory,
        fqn,
        'edit-ingestion',
        ingestionFQN,
        ingestionType
      );
    default: {
      const unsupportedAction: never = action;

      throw new Error(
        `Unsupported classic service action: ${unsupportedAction}`
      );
    }
  }
};

const RedirectPreservingLocation = ({ to }: { to: string }) => {
  const { search, hash } = useLocation();

  return <Navigate replace to={`${to}${search}${hash}`} />;
};

const ClassicServiceActionRedirect = ({
  action,
}: {
  action: ClassicServiceAction;
}) => {
  const params = useParams<ClassicServiceRouteParams>();

  return (
    <RedirectPreservingLocation
      to={getClassicServiceActionTarget(action, params)}
    />
  );
};

/**
 * Bridges Collate's `/service/<cat>/<fqn>` URL pattern (produced by
 * `RouterUtils.getServiceDetailsPath` and used by Collate breadcrumbs)
 * onto AI's `/connections/<cat>/<fqn>` URL space. Without this, an AI
 * user clicking a Collate-built service breadcrumb would land on
 * Collate's `ServiceDetailsPage` via the `AuthenticatedAppRouter`
 * catch-all instead of AI's `ConnectionServiceDetailsPage`.
 *
 * `/service/<cat>/<fqn>/connection` is owned by AI's shared
 * `SERVICE_CONNECTION` route (more specific), so it still resolves
 * to the connection view rather than this redirect.
 */
const ServiceToConnectionsRedirect = () => {
  const { serviceCategory, fqn, tab } = useParams<ClassicServiceRouteParams>();
  // `useParams` returns decoded values; re-encode on the way out so an
  // FQN containing `/` (the common `service.database.schema.table` shape
  // arrives as `%2F`-encoded segments) doesn't collapse into extra path
  // segments at the redirect target. The AI ConnectionServiceDetailsPage
  // does not have a sub-tab concept, so a `:subTab` segment (e.g. the
  // `agents/metadata` URL produced by openmetadata-ui's AddIngestionPage
  // after save) is intentionally dropped on redirect.
  const base = getConnectionsServiceBase(serviceCategory, fqn);
  const target = tab ? `${base}/${encodeRouteParam(tab)}` : base;

  return <RedirectPreservingLocation to={target} />;
};

const ConnectionsLayout = withSuspenseFallback(
  React.lazy(() => import('./ConnectionsLayout/ConnectionsLayout'))
);

const ConnectionsPage = withSuspenseFallback(
  React.lazy(() => import('./ConnectionsPage/ConnectionsPage'))
);

const ConnectionServiceDetailsPage = withSuspenseFallback(
  React.lazy(() => import('./ConnectionServiceDetailsPage'))
);

const EditConnectionFormPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/EditConnectionFormPage/EditConnectionFormPage.component'
      )
  )
);

const EmbeddedAddServicePage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../pages/EmbeddedAddServicePage/EmbeddedAddServicePage.component'
      )
  )
);

const EditIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/EditIngestionPage/EditIngestionPage.component')
  )
);

const AddIngestionPage = withSuspenseFallback(
  React.lazy(
    () => import('../../pages/AddIngestionPage/AddIngestionPage.component')
  )
);

const ServiceVersionPage = withSuspenseFallback(
  React.lazy(() => import('../../pages/ServiceVersionPage/ServiceVersionPage'))
);

/**
 * Base route table for the `connections` module — everything except
 * `AGENT_JOB_DETAILS`, which is not an OSS page: it arrives as a
 * `CONNECTIONS_ROUTES` (`EXTENSION_POINTS.CONNECTIONS_ROUTES`) contribution
 * from Collate's plugin and is spliced in by `resolveRoutes` below, ahead of
 * the generic `:tab` route so its more specific path wins react-router
 * matching.
 */
const BASE_ROUTES: PluginRouteProps[] = [
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS,
    element: (
      <ConnectionsLayout>
        <ConnectionsPage />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS,
    element: (
      <ConnectionsLayout>
        <ConnectionServiceDetailsPage />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS_EDIT_CONNECTION,
    element: (
      <ConnectionsLayout>
        <EditConnectionFormPage
          pageTitle={i18n.t('label.edit-entity', {
            entity: i18n.t('label.connection'),
          })}
        />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS_ADD_SERVICE,
    element: (
      <ConnectionsLayout>
        <EmbeddedAddServicePage
          pageTitle={i18n.t('label.add-entity', {
            entity: i18n.t('label.service'),
          })}
        />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS_EDIT_INGESTION,
    element: (
      <ConnectionsLayout>
        <EditIngestionPage
          pageTitle={i18n.t('label.edit-entity', {
            entity: i18n.t('label.ingestion'),
          })}
        />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS_ADD_INGESTION,
    element: (
      <ConnectionsLayout>
        <AddIngestionPage
          pageTitle={i18n.t('label.add-entity', {
            entity: i18n.t('label.ingestion'),
          })}
        />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  {
    path: CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS_TAB,
    element: (
      <ConnectionsLayout>
        <ConnectionServiceDetailsPage />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  // Classic service action URLs are still emitted by upstream pages and old
  // bookmarks. Register their exact patterns ahead of the generic service
  // bridge so static action segments retain their full meaning.
  {
    path: ROUTES.EDIT_SERVICE_CONNECTION,
    element: <ClassicServiceActionRedirect action="edit-connection" />,
    position: RoutePosition.APP,
  },
  {
    path: ROUTES.ADD_INGESTION,
    element: <ClassicServiceActionRedirect action="add-ingestion" />,
    position: RoutePosition.APP,
  },
  {
    path: ROUTES.EDIT_INGESTION,
    element: <ClassicServiceActionRedirect action="edit-ingestion" />,
    position: RoutePosition.APP,
  },
  {
    path: ROUTES.SERVICE_VERSION,
    element: (
      <ConnectionsLayout>
        <ServiceVersionPage />
      </ConnectionsLayout>
    ),
    position: RoutePosition.APP,
  },
  // Redirects from Collate's /service/<cat>/<fqn>(/<tab>) URL pattern
  // to AI's /connections/<cat>/<fqn>(/<tab>) namespace. Sources:
  // Collate-built breadcrumbs + any link that calls
  // `RouterUtils.getServiceDetailsPath` while the user is in AI mode.
  {
    path: ROUTES.SERVICE,
    element: <ServiceToConnectionsRedirect />,
    position: RoutePosition.APP,
  },
  {
    path: ROUTES.SERVICE_WITH_TAB,
    element: <ServiceToConnectionsRedirect />,
    position: RoutePosition.APP,
  },
  {
    path: ROUTES.SERVICE_WITH_SUB_TAB,
    element: <ServiceToConnectionsRedirect />,
    position: RoutePosition.APP,
  },
];

export const connectionsModule: AppModule & {
  resolveRoutes: (registry: ExtensionPointRegistry) => PluginRouteProps[];
} = {
  id: 'connections',
  navOrder: 20,
  labelKey: 'label.connection-plural',
  icon: ConnectorsIcon,
  activeIcon: ConnectionsActiveIcon,
  prefix: CONNECTIONS_ROUTES.CONNECTIONS,
  defaultPath: CONNECTIONS_ROUTES.CONNECTIONS,
  routes: BASE_ROUTES,
  resolveRoutes(registry) {
    const contributed = registry
      .getContributions<RouteContribution>(EXTENSION_POINTS.CONNECTIONS_ROUTES)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((c) => c.route);

    // Contributed routes (e.g. AgentJob) go before the generic :tab route so
    // their more specific path wins react-router matching.
    const tabIndex = BASE_ROUTES.findIndex(
      (r) => r.path === CONNECTIONS_ROUTES.CONNECTIONS_SERVICE_DETAILS_TAB
    );

    return [
      ...BASE_ROUTES.slice(0, tabIndex),
      ...contributed,
      ...BASE_ROUTES.slice(tabIndex),
    ];
  },
};
