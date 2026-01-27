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
export interface OverviewSectionProps {
  onEdit?: () => void;
  showEditButton?: boolean;
  entityInfoV1?: Array<{
    name: string;
    value?: unknown;
    url?: string;
    linkProps?: import('react-router-dom').To;
    isLink?: boolean;
    isExternal?: boolean;
    visible?: string[];
  }>;
  componentType?: string;
  isDomainVisible?: boolean;
  onLinkClick?: () => void;
}
