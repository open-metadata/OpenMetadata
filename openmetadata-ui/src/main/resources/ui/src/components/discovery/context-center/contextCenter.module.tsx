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
import { Navigate } from 'react-router-dom';
import { ReactComponent as ArchiveActiveIcon } from '../../../assets/svg/archive-active.svg';
import { ReactComponent as ArchiveIcon } from '../../../assets/svg/archive-default.svg';
import { ReactComponent as ArticleActiveIcon } from '../../../assets/svg/article-active.svg';
import { ReactComponent as ArticleIcon } from '../../../assets/svg/article-default.svg';
import { ReactComponent as ContextCenterActiveIcon } from '../../../assets/svg/context-center-active.svg';
import { ReactComponent as ContextCenterIcon } from '../../../assets/svg/context-center-default.svg';
import { ReactComponent as DashboardActiveIcon } from '../../../assets/svg/dashboard-active.svg';
import { ReactComponent as DashboardIcon } from '../../../assets/svg/dashboard-default.svg';
import { ReactComponent as DocumentActiveIcon } from '../../../assets/svg/document-active.svg';
import { ReactComponent as DocumentIcon } from '../../../assets/svg/document-default.svg';
import { ReactComponent as MemoriesActiveIcon } from '../../../assets/svg/memories-active.svg';
import { ReactComponent as MemoriesIcon } from '../../../assets/svg/memories-default.svg';
import { ROUTES } from '../../../constants/constants';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import { AppModule } from '../../platform/ai-shell/AppModule.types';
import { RoutePosition } from '../../Settings/Applications/plugins/AppPlugin';

const ContextCenterLayout = withSuspenseFallback(
  React.lazy(
    () => import('../../ContextCenter/ContextCenterLayout/ContextCenterLayout')
  )
);

const ContextCenterDashboardPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterDashboardPage/ContextCenterDashboardPage'
      )
  )
);

const KnowledgeCenterFilterPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/KnowledgeCenterFilterPage/KnowledgeCenterFilterPage'
      )
  )
);

const ContextCenterArticlesPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterArticlesPage/ContextCenterArticlesPage'
      )
  )
);

const ContextCenterDocumentsPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterDocumentsPage/ContextCenterDocumentsPage'
      )
  )
);

const ContextCenterMemoriesPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterMemoriesPage/ContextCenterMemoriesPage'
      )
  )
);

const ContextCenterArchivePage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterArchivePage/ContextCenterArchivePage'
      )
  )
);

export const contextCenterModule: AppModule = {
  id: 'context-center',
  navOrder: 60,
  labelKey: 'label.context-center',
  icon: ContextCenterIcon,
  activeIcon: ContextCenterActiveIcon,
  prefix: ROUTES.CONTEXT_CENTER,
  defaultPath: ROUTES.CONTEXT_CENTER,
  routes: [
    {
      path: ROUTES.CONTEXT_CENTER,
      element: <Navigate replace to={ROUTES.CONTEXT_CENTER_DASHBOARD} />,
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_DASHBOARD,
      element: (
        <ContextCenterLayout>
          <ContextCenterDashboardPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_FILTER,
      element: (
        <ContextCenterLayout>
          <KnowledgeCenterFilterPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_ARTICLES,
      element: (
        <ContextCenterLayout>
          <ContextCenterArticlesPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL,
      element: (
        <ContextCenterLayout>
          <ContextCenterArticlesPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_TAB,
      element: (
        <ContextCenterLayout>
          <ContextCenterArticlesPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_SUB_TAB,
      element: (
        <ContextCenterLayout>
          <ContextCenterArticlesPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_ARTICLE_VERSION,
      element: (
        <ContextCenterLayout>
          <ContextCenterArticlesPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_DOCUMENTS,
      element: (
        <ContextCenterLayout>
          <ContextCenterDocumentsPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_MEMORIES,
      element: (
        <ContextCenterLayout>
          <ContextCenterMemoriesPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_ARCHIVE,
      element: (
        <ContextCenterLayout>
          <ContextCenterArchivePage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
  ],
  subNav: {
    key: 'context-center',
    titleKey: 'label.context-center',
    rootPath: ROUTES.CONTEXT_CENTER,
    sections: [
      {
        items: [
          {
            key: 'dashboard',
            icon: DashboardIcon,
            activeIcon: DashboardActiveIcon,
            labelKey: 'label.dashboard',
            path: ROUTES.CONTEXT_CENTER_DASHBOARD,
          },
          {
            key: 'articles',
            icon: ArticleIcon,
            activeIcon: ArticleActiveIcon,
            labelKey: 'label.article-plural',
            path: ROUTES.CONTEXT_CENTER_ARTICLES,
          },
          {
            key: 'documents',
            icon: DocumentIcon,
            activeIcon: DocumentActiveIcon,
            labelKey: 'label.document-plural',
            path: ROUTES.CONTEXT_CENTER_DOCUMENTS,
          },
          {
            key: 'memories',
            icon: MemoriesIcon,
            activeIcon: MemoriesActiveIcon,
            labelKey: 'label.memory-plural',
            path: ROUTES.CONTEXT_CENTER_MEMORIES,
          },
          {
            key: 'archive',
            icon: ArchiveIcon,
            activeIcon: ArchiveActiveIcon,
            labelKey: 'label.archive',
            path: ROUTES.CONTEXT_CENTER_ARCHIVE,
          },
        ],
      },
    ],
  },
};
