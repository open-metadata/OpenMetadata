/*
 *  Copyright 2022 Collate.
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

import { Team } from '../../generated/entity/teams/team';

export interface TeamHierarchyProps {
  currentTeam?: Team;
  data: Team[];
  onTeamExpand: (
    loading?: boolean,
    parentTeam?: string,
    updateChildNode?: boolean
  ) => void;
}

export interface DraggableBodyRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  index: number;
  handleMoveRow: (dragRecord: Team, dropRecord: Team) => void;
  record: Team;
}

export interface MovedTeamProps {
  from: Team;
  to: Team;
}

export interface DragCollectProps {
  getItem: () => { index: number };
  isOver: (options?: { shallow?: boolean }) => boolean;
}

export interface TableExpandableDataProps {
  expanded: boolean;
  onExpand: (record: Team, event: React.MouseEvent<HTMLElement>) => void;
  expandable: boolean;
  record: Team;
}
