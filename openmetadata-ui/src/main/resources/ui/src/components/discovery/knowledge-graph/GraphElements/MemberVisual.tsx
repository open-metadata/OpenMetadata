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

import { Avatar } from '@openmetadata/ui-core-components';
import { Users01 } from '@openmetadata/ui-core-components/icons';
import type { ReactNode } from 'react';
import type { GraphNode } from '../../../../interface/discovery/knowledge-graph.interface';
import { getGraphNodeLabel } from '../../../../utils/discovery/knowledge-graph/knowledgeGraphPresentation.utils';

interface MemberVisualProps {
  member: GraphNode;
  /** Rendered entity-type icon, shown for members that are not people. */
  icon: ReactNode;
}

/** Leading visual for a bundled member: people get an avatar, entities their type icon. */
const MemberVisual = ({ member, icon }: MemberVisualProps) => {
  const type = member.type.toLowerCase();
  if (type === 'user') {
    const name = getGraphNodeLabel(member);

    return (
      <Avatar
        alt={name}
        className="tw:shrink-0"
        initials={name.trim().charAt(0).toUpperCase()}
        size="xxs"
      />
    );
  }
  if (type === 'team') {
    return (
      <Avatar
        className="tw:shrink-0"
        colorVariant="neutral"
        placeholderIcon={Users01}
        size="xxs"
      />
    );
  }

  return icon;
};

export default MemberVisual;
