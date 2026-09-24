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
import { isEmpty } from 'lodash';
import { EntityReference } from '../../../generated/entity/type';
import DomainTags from '../DomainTags/DomainTags';

interface DomainDisplayProps {
  domains: EntityReference[];
  /** Retained for API compatibility; DomainTag renders its own domain glyph. */
  showIcon?: boolean;
  className?: string;
}

/**
 * Read-only domain display used on cards (e.g. explore result cards). Delegates
 * to the shared DomainTags so domains render as the same DomainTag chips used
 * across the app, with the first domain shown and the rest behind "+N More".
 */
export const DomainDisplay = ({ domains, className }: DomainDisplayProps) => {
  if (isEmpty(domains)) {
    return null;
  }

  return <DomainTags className={className} domains={domains} maxVisible={1} />;
};
