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

import type React from 'react';
import {
  PLACEHOLDER_ROUTE_FQN,
  PLACEHOLDER_ROUTE_SUB_TAB,
  PLACEHOLDER_ROUTE_TAB,
  PLACEHOLDER_ROUTE_VERSION,
  ROUTES,
} from '../constants/constants';
import { EntityTabs } from '../enums/entity.enum';

class ContextCenterClassBase {
  public setEmbeddedMode(_flag: boolean): void {
    // no-op in base; overridden in Collate
  }

  public isEmbeddedMode(): boolean {
    return false;
  }

  public getCardStyle(): React.CSSProperties {
    return {};
  }

  public isBreadcrumbInsideCard(): boolean {
    return false;
  }

  public getBreadcrumbClassName(): string {
    return '';
  }

  public getContainerClassName(): string {
    return '';
  }

  public getContextCenterPath(): string {
    return ROUTES.CONTEXT_CENTER;
  }

  public getArticlesListPath(): string {
    return ROUTES.CONTEXT_CENTER_ARTICLES;
  }

  public getDocumentsListPath(): string {
    return ROUTES.CONTEXT_CENTER_DOCUMENTS;
  }

  public getArticlePath(
    pageName: string,
    tab?: string,
    subTab = 'all'
  ): string {
    let path = tab
      ? ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_TAB
      : ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL;

    if (tab === EntityTabs.ACTIVITY_FEED) {
      path = ROUTES.CONTEXT_CENTER_ARTICLE_DETAIL_WITH_SUB_TAB;
      path = path.replace(PLACEHOLDER_ROUTE_SUB_TAB, subTab);
    }

    if (tab) {
      path = path.replace(PLACEHOLDER_ROUTE_TAB, tab);
    }

    return path.replace(PLACEHOLDER_ROUTE_FQN, pageName);
  }

  public getArticleVersionPath(pageName: string, version: string): string {
    return ROUTES.CONTEXT_CENTER_ARTICLE_VERSION.replace(
      PLACEHOLDER_ROUTE_FQN,
      pageName
    ).replace(PLACEHOLDER_ROUTE_VERSION, version);
  }
}

const contextCenterClassBase = new ContextCenterClassBase();

export default contextCenterClassBase;
export { ContextCenterClassBase };
