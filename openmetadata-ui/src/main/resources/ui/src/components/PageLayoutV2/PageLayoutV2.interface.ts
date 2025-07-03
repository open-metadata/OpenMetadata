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
import { ReactNode } from 'react';

export interface PageLayoutV2Props {
  /**
   * The main content to be rendered in the page
   */
  children: ReactNode;

  /**
   * The title of the page
   */
  pageTitle: string;

  /**
   * Optional breadcrumb items
   */
  breadcrumbs?: Array<{
    label: string;
    path?: string;
  }>;

  /**
   * Optional header content (will be rendered above the main content)
   */
  header?: ReactNode;

  /**
   * Additional CSS class names
   */
  className?: string;

  /**
   * Additional CSS styles
   */
  style?: React.CSSProperties;
}
