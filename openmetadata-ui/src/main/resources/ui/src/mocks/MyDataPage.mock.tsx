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

import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import { Document } from '../generated/entity/docStore/document';
import { Thread, ThreadType } from '../generated/entity/feed/thread';
import { User } from '../generated/entity/teams/user';
import { PageType } from '../generated/system/ui/page';
import { Paging } from '../generated/type/paging';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';

export const mockPersonaName = 'testPersona';

export const mockUserData: User = {
  name: 'Test User',
  email: 'testUser1@email.com',
  id: '123',
  isAdmin: true,
  follows: [
    {
      id: '12',
      type: 'table',
    },
  ],
};

export const mockDefaultLayout: Array<WidgetConfig> = [
  {
    h: 6,
    i: LandingPageWidgetKeys.ACTIVITY_FEED,
    w: 3,
    x: 0,
    y: 0,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.MY_DATA,
    w: 1,
    x: 0,
    y: 6,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.KPI,
    w: 2,
    x: 1,
    y: 6,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.TOTAL_DATA_ASSETS,
    w: 3,
    x: 0,
    y: 9,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.FOLLOWING,
    w: 1,
    x: 3,
    y: 1.5,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.RECENTLY_VIEWED,
    w: 1,
    x: 3,
    y: 3,
    static: false,
  },
];

export const mockCustomizedLayout: Array<WidgetConfig> = [
  {
    h: 6,
    i: LandingPageWidgetKeys.ACTIVITY_FEED,
    w: 3,
    x: 0,
    y: 0,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.FOLLOWING,
    w: 1,
    x: 3,
    y: 1.5,
    static: false,
  },
  {
    h: 3,
    i: LandingPageWidgetKeys.RECENTLY_VIEWED,
    w: 1,
    x: 3,
    y: 3,
    static: false,
  },
];

export const mockCustomizePageClassBase = {
  defaultLayout: mockDefaultLayout,
  announcementWidget: {
    h: 3,
    i: LandingPageWidgetKeys.ANNOUNCEMENTS,
    w: 1,
    x: 3,
    y: 0,
    static: true,
  } as WidgetConfig,
  landingPageMaxGridSize: 4,
  landingPageWidgetMargin: 16,
  landingPageRowHeight: 200,
  getWidgetsFromKey: (i: string) => () => <div>{i}</div>,
};

export const mockDocumentData: Document = {
  name: `${mockPersonaName}-LandingPage`,
  fullyQualifiedName: `persona.${mockPersonaName}.Page.LandingPage`,
  entityType: 'Page',
  data: {
    pages: [
      {
        pageType: PageType.LandingPage,
        layout: mockCustomizedLayout,
      },
    ],
  },
};

export const mockAnnouncementsData: Array<Thread> = [
  {
    id: '444c10b8-e0bb-4e0b-9286-1eeaa2efbf95',
    type: ThreadType.Announcement,
    about: '<#E::table::sample_data.ecommerce_db.shopify.dim_address>',
    message: 'Test Announcement',
    announcement: {
      description: '',
      startTime: 1701620135,
      endTime: 1701706538,
    },
  },
];

export const mockActiveAnnouncementData: { data: Thread[]; paging: Paging } = {
  data: mockAnnouncementsData,
  paging: { total: 1 },
};
