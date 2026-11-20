/*
 *  Copyright 2024 Collate.
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
  Api,
  AppSlack,
  Book,
  Tour,
  VersionBlack,
} from '@openmetadata/ui-core-components/icons';
import { useProductTourStore } from '../hooks/useProductTourStore';
import documentationLinksClassBase from '../utils/DocumentationLinksClassBase';

import { ROUTES } from './constants';
import { URL_JOIN_SLACK, URL_OM_RELEASE_UPDATES } from './URL.constants';

export enum HELP_ITEMS_ENUM {
  TOUR = 'tour',
  DOC = 'doc',
  API = 'api',
  SLACK = 'slack',
  VERSION = 'version',
}

export interface SupportItem {
  key: HELP_ITEMS_ENUM;
  label: string;
  icon: SvgComponent;
  link?: string;
  isExternal: boolean;
  handleSupportItemClick?: () => void;
}

export const HELP_ITEMS = [
  {
    key: HELP_ITEMS_ENUM.TOUR,
    label: 'label.tour',
    icon: Tour,
    isExternal: false,
    handleSupportItemClick: () => useProductTourStore.getState().open(),
  },
  {
    key: HELP_ITEMS_ENUM.DOC,
    label: 'label.doc-plural',
    icon: Book,
    link: documentationLinksClassBase.getDocsBaseURL(),
    isExternal: true,
  },
  {
    key: HELP_ITEMS_ENUM.API,
    label: 'label.api-uppercase',
    icon: Api,
    link: ROUTES.SWAGGER,
    isExternal: false,
  },
  {
    key: HELP_ITEMS_ENUM.SLACK,
    label: 'label.slack-support',
    icon: AppSlack,
    link: URL_JOIN_SLACK,
    isExternal: true,
  },
  {
    key: HELP_ITEMS_ENUM.VERSION,
    label: 'label.version',
    icon: VersionBlack,
    link: URL_OM_RELEASE_UPDATES,
    isExternal: true,
  },
];
