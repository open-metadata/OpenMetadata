import { EntityReference as UserTeams } from '../generated/entity/teams/user';

export type UserTeam = {
  displayName?: string;
} & UserTeams;
