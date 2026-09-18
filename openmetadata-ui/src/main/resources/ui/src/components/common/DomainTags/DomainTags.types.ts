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
import type { TagSize } from '@openmetadata/ui-core-components';
import { EntityReference } from '../../../generated/entity/type';

export interface DomainTagsProps {
  /** Domains to display as chips. */
  domains?: EntityReference[];
  /**
   * When provided, each chip renders a remove (X) button that calls this with
   * the removed domain. When omitted, chips link to the domain detail page.
   */
  onRemove?: (domain: EntityReference) => void;
  /** Chips shown before collapsing behind a "+N More" toggle. @default 5 */
  maxVisible?: number;
  size?: TagSize;
  /** Render the inherit glyph on inherited domains. @default true */
  showInheritedIcon?: boolean;
  className?: string;
  'data-testid'?: string;
}
