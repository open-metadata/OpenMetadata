import { isEmpty } from 'lodash';
import { UserTeam } from 'Models';
import AppState from '../AppState';

export const arraySorterByKey = (
  key: string,
  sortDescending = false
): Function => {
  const sortOrder = sortDescending ? -1 : 1;

  return (
    elementOne: { [x: string]: number | string },
    elementTwo: { [x: string]: number | string }
  ) => {
    return (
      (elementOne[key] < elementTwo[key]
        ? -1
        : elementOne[key] > elementTwo[key]
        ? 1
        : 0) * sortOrder
    );
  };
};

export const isEven = (value: number): boolean => {
  return value % 2 === 0;
};

export const getTableFQNFromColumnFQN = (columnFQN: string): string => {
  const arrColFQN = columnFQN.split('.');

  return arrColFQN.slice(0, arrColFQN.length - 1).join('.');
};

export const getPartialNameFromFQN = (
  fqn: string,
  arrTypes: Array<'service' | 'database' | 'table' | 'column'> = []
): string => {
  const arrFqn = fqn.split('.');
  const arrPartialName = [];
  for (const type of arrTypes) {
    if (type === 'service' && arrFqn.length > 0) {
      arrPartialName.push(arrFqn[0]);
    } else if (type === 'database' && arrFqn.length > 1) {
      arrPartialName.push(arrFqn[1]);
    } else if (type === 'table' && arrFqn.length > 2) {
      arrPartialName.push(arrFqn[2]);
    } else if (type === 'column' && arrFqn.length > 3) {
      arrPartialName.push(arrFqn[3]);
    }
  }

  return arrPartialName.join('/');
};

export const getCurrentUserId = (): string => {
  // TODO: Replace below with USERID from Logged-in data
  const { id: userId } = !isEmpty(AppState.userDetails)
    ? AppState.userDetails
    : AppState.users?.length
    ? AppState.users[0]
    : { id: undefined };

  return userId as string;
};

export const pluralize = (count: number, noun: string, suffix = 's') => {
  return `${count.toLocaleString()} ${noun}${
    count !== 1 && count !== 0 ? suffix : ''
  }`;
};

export const getUserTeams = (): Array<UserTeam> => {
  let retVal: Array<UserTeam>;
  if (AppState.userDetails.teams) {
    retVal = AppState.userDetails.teams.map((item) => {
      const team = AppState.userTeams.find((obj) => obj.id === item.id);

      return { ...item, displayName: team?.displayName };
    });
  } else {
    retVal = AppState.userTeams;
  }

  return retVal;
};
