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
import { Persona } from '../generated/entity/teams/persona';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';

export const mockPersonaName = 'testPersona';
export const mockPersonaDetails: Persona = {
  id: 'persona-123',
  name: mockPersonaName,
};

const mockDefaultLayout: Array<WidgetConfig> = [
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

export const mockCustomizedLayout1: Array<WidgetConfig> = [
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

export const mockCustomizedLayout2: Array<WidgetConfig> = [
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
  {
    h: 3,
    i: LandingPageWidgetKeys.KPI,
    w: 1,
    x: 3,
    y: 3,
    static: false,
  },
];

export const mockDocumentData: Document = {
  name: `${mockPersonaName}-LandingPage`,
  id: 'landing-page-123',
  fullyQualifiedName: `persona.${mockPersonaName}.Page.LandingPage`,
  entityType: 'Page',
  data: {
    page: {
      layout: mockCustomizedLayout1,
    },
  },
};

export const mockCustomizePageClassBase = {
  defaultLayout: mockDefaultLayout,
};

export const mockShowErrorToast = jest.fn();
export const mockShowSuccessToast = jest.fn();
