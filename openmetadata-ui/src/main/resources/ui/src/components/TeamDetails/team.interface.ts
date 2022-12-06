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
  moveRow: (dragRecord: Team, dropRecord: Team) => void;
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
