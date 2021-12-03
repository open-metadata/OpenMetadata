import { isEmpty } from 'lodash';
import { Ownership } from '../enums/mydata.enum';
import { User } from '../generated/entity/teams/user';
import { getCurrentUserId } from './CommonUtils';

export const getMyDataFilters = (
  filter: Ownership,
  userDetails: User
): string => {
  if (filter === Ownership.OWNER && userDetails.teams) {
    const userTeams = !isEmpty(userDetails)
      ? userDetails.teams.map((team) => `${filter}:${team.id}`)
      : [];
    const ownerIds = [...userTeams, `${filter}:${getCurrentUserId()}`];

    return `(${ownerIds.join(' OR ')})`;
  } else {
    return `${filter}:${getCurrentUserId()}`;
  }
};
