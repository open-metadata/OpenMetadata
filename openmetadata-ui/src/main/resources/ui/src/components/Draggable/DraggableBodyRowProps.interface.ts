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

import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Team } from '../../generated/entity/teams/team';

export type DraggableUnion = Team | GlossaryTerm;

export interface DraggableBodyRowProps<T>
  extends React.HTMLAttributes<HTMLTableRowElement> {
  index?: number;
  record?: T;
  handleMoveRow: (dragRecord: T, dropRecord?: T) => void;
  handleTableHover?: (value: boolean) => void;
}

export interface DragCollectProps {
  getItem: () => { index: number };
  isOver: (options?: { shallow?: boolean }) => boolean;
}
