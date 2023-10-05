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
    w: 3, // similler to gridSize of docStore
    h: 4, // for now we can have this hardcodede as we won't support variable height
    x: 0, // x position in the page, works in grid manner. If we have 4 cols in total 0 represent first segment
    y: 0, // y position in the page
    i: 'KnowledgePanel.ActivityFeed', // fqn of the knowledge panel that needs to be placed
    static: false, // used for right hand side panel
  },
  {
    w: 1,
    h: 2,
    x: 0,
    y: 4,
    i: 'KnowledgePanel.MyData',
    static: false,
  },
  {
    w: 2,
    h: 2,
    x: 1,
    y: 4,
    i: 'KnowledgePanel.KPI',
    static: false,
  },
  {
    w: 3,
    h: 2.2,
    x: 0,
    y: 6,
    i: 'KnowledgePanel.TotalDataAssets',
    static: false,
  },
  {
    w: 1,
    h: 9,
    x: 3,
    y: 0,
    i: 'Container.RightSidebar',
    static: true,
    childrenConfig: {
      layout: [
        {
          w: 1,
          h: 1.5,
          x: 0,
          y: 0,
          i: 'KnowledgePanel.Annoucements',
          static: false,
        },
        {
          w: 1,
          h: 1.5,
          x: 0,
          y: 1.5,
          i: 'KnowledgePanel.Following',
          static: false,
        },
        {
          w: 1,
          h: 1.5,
          x: 0,
          y: 3,
          i: 'KnowledgePanel.RecentlyViewed',
          static: false,
        },
      ],
    },
  },
];
