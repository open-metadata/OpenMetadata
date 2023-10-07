/*
 *  Copyright 2023 Collate.
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
export const LANDING_PAGE_LAYOUT = [
  {
    h: 3.1,
    i: 'KnowledgePanel.MyData',
    w: 1,
    x: 0,
    y: 6,
    static: false,
  },
  {
    h: 3.42,
    i: 'KnowledgePanel.TotalDataAssets',
    w: 3,
    x: 0,
    y: 9.1,
    static: false,
  },
  {
    h: 6,
    i: 'Container.RightSidebar',
    w: 1,
    x: 3,
    y: 0,
    data: {
      page: {
        layout: [
          {
            h: 1.5,
            i: 'KnowledgePanel.Announcements',
            w: 1,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 1.5,
            i: 'KnowledgePanel.Following',
            w: 1,
            x: 0,
            y: 1.5,
            static: false,
          },
          {
            h: 1.5,
            i: 'KnowledgePanel.RecentlyViewed',
            w: 1,
            x: 0,
            y: 3,
            static: false,
          },
        ],
        knowledgePanels: [
          {
            name: 'KnowledgePanel.Announcements',
            type: 'KnowLedgePanels',
          },
          {
            name: 'KnowledgePanel.Following',
            type: 'KnowLedgePanels',
          },
          {
            name: 'KnowledgePanel.RecentlyViewed',
            type: 'KnowLedgePanels',
          },
        ],
      },
    },
    static: true,
  },
  {
    h: 6,
    i: 'KnowledgePanel.ActivityFeed',
    w: 3,
    x: 0,
    y: 0,
    static: false,
  },
  {
    h: 3.1,
    i: 'KnowledgePanel.KPI',
    w: 2,
    x: 1,
    y: 6,
    static: false,
  },
];

export const pageData = {
  name: 'LandingPage',
  fullyQualifiedName: 'persona.TestPersona.Page.LandingPage',
  entityType: 'Page',
  data: {
    page: {
      layout: [
        {
          h: 3.1,
          i: 'KnowledgePanel.MyData',
          w: 1,
          x: 0,
          y: 6.3,
          moved: false,
          static: false,
        },
        {
          h: 3.42,
          i: 'KnowledgePanel.TotalDataAssets',
          w: 3,
          x: 0,
          y: 9.4,
          moved: false,
          static: false,
        },
        {
          h: 6,
          i: 'Container.RightSidebar',
          w: 1,
          x: 3,
          y: 0,
          data: {
            page: {
              layout: [
                {
                  h: 1.5,
                  i: 'KnowledgePanel.RecentlyViewed',
                  w: 1,
                  x: 0,
                  y: 4.8,
                  moved: false,
                  static: false,
                },
                {
                  h: 2.3,
                  i: 'KnowledgePanel.Following',
                  w: 1,
                  x: 0,
                  y: 2.5,
                  moved: false,
                  static: false,
                },
                {
                  h: 2.3,
                  i: 'KnowledgePanel.RecentlyVisited',
                  w: 1,
                  x: 0,
                  y: 0.2,
                  moved: false,
                  static: false,
                },
              ],
            },
          },
          moved: false,
          static: true,
        },
        {
          h: 6,
          i: 'KnowledgePanel.ActivityFeed',
          w: 3,
          x: 0,
          y: 0.3,
          moved: false,
          static: false,
        },
        {
          h: 3.1,
          i: 'KnowledgePanel.KPI',
          w: 2,
          x: 1,
          y: 6.3,
          moved: false,
          static: false,
        },
      ],
      pageType: 'LandingPage',
      knowledgePanels: [
        {
          name: 'KnowledgePanel.ActivityFeed',
          type: 'KnowLedgePanels',
        },
        {
          name: 'KnowledgePanel.MyData',
          type: 'KnowLedgePanels',
        },
        {
          name: 'KnowledgePanel.KPI',
          type: 'KnowLedgePanels',
        },
        {
          name: 'KnowledgePanel.TotalDataAssets',
          type: 'KnowLedgePanels',
        },
        {
          name: 'Container.RightSidebar',
          type: 'KnowLedgePanels',
        },
      ],
    },
  },
  updatedAt: 1696667113677,
  updatedBy: 'admin',
  version: 3.9,
  href: 'http://localhost:8585/api/v1/docStore/91bef041-20c5-4bea-8e17-576fba6436a4',
};
