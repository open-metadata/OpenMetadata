import { EntityReference as UserTeams } from '../generated/entity/teams/user';

export interface UserTeam extends UserTeams {
  displayName?: string;
}
