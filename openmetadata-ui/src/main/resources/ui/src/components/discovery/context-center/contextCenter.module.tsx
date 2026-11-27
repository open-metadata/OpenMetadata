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
  Archive,
  ArchiveFilled,
  Article,
  ArticleFilled,
  ContextCenter,
  ContextCenterFilled,
  FolderCheck,
  FolderCheck02,
  Grid01,
  GridFilled,
  Memories,
  MemoriesFilled,
  Persona,
} from '@openmetadata/ui-core-components/icons';
import React from 'react';
import { Navigate } from 'react-router-dom';
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

const ContextCenterAIContextPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterAIContextPage/ContextCenterAIContextPage'
      )
  )
);

const ContextCenterAIContextDetailPage = withSuspenseFallback(
  React.lazy(
    () =>
      import(
        '../../../pages/ContextCenterPage/ContextCenterAIContextPage/ContextCenterAIContextDetailPage'
      )
  )
);

export const contextCenterModule: AppModule = {
  id: 'context-center',
  navOrder: 80,
  labelKey: 'label.context-center',
  icon: ContextCenter,
  activeIcon: ContextCenterFilled,
  prefix: ROUTES.CONTEXT_CENTER,
  defaultPath: ROUTES.CONTEXT_CENTER,
  routes: [
    {
      path: ROUTES.CONTEXT_CENTER,
      element: <Navigate replace to={ROUTES.CONTEXT_CENTER_OVERVIEW} />,
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_OVERVIEW,
      element: (
        <ContextCenterLayout>
          <ContextCenterDashboardPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_AI_CONTEXT,
      element: (
        <ContextCenterLayout>
          <ContextCenterAIContextPage />
        </ContextCenterLayout>
      ),
      position: RoutePosition.APP,
    },
    {
      path: ROUTES.CONTEXT_CENTER_AI_CONTEXT_DETAIL,
      element: (
        <ContextCenterLayout>
          <ContextCenterAIContextDetailPage />
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
            icon: Grid01,
            activeIcon: GridFilled,
            labelKey: 'label.overview',
            path: ROUTES.CONTEXT_CENTER_OVERVIEW,
          },
          {
            key: 'ai-context',
            icon: Persona,
            activeIcon: Persona,
            labelKey: 'label.ai-context',
            path: ROUTES.CONTEXT_CENTER_AI_CONTEXT,
          },
          {
            key: 'articles',
            icon: Article,
            activeIcon: ArticleFilled,
            labelKey: 'label.article-plural',
            path: ROUTES.CONTEXT_CENTER_ARTICLES,
          },
          {
            key: 'documents',
            icon: FolderCheck02,
            activeIcon: FolderCheck,
            labelKey: 'label.document-plural',
            path: ROUTES.CONTEXT_CENTER_DOCUMENTS,
          },
          {
            key: 'memories',
            icon: Memories,
            activeIcon: MemoriesFilled,
            labelKey: 'label.memory-plural',
            path: ROUTES.CONTEXT_CENTER_MEMORIES,
          },
          {
            key: 'archive',
            icon: Archive,
            activeIcon: ArchiveFilled,
            labelKey: 'label.archive',
            path: ROUTES.CONTEXT_CENTER_ARCHIVE,
          },
        ],
      },
    ],
  },
};
