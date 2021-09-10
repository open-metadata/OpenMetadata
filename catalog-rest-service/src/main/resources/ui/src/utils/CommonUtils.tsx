import { isEmpty } from 'lodash';
import { RecentlyViewed, RecentlyViewedData, UserTeam } from 'Models';
import React from 'react';
import { reactLocalStorage } from 'reactjs-localstorage';
import AppState from '../AppState';
import { LOCALSTORAGE_RECENTLY_VIEWED } from '../constants/constants';
import { countBackground } from './styleconstant';

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
  arrTypes: Array<'service' | 'database' | 'table' | 'column'> = [],
  joinSeperator = '/'
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

  return arrPartialName.join(joinSeperator);
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

export const getTabClasses = (
  tab: number | string,
  activeTab: number | string
) => {
  return 'tw-gh-tabs' + (activeTab === tab ? ' active' : '');
};

export const getCountBadge = (count = 0) => {
  return (
    <span
      className=" tw-py-0.5 tw-px-1 tw-ml-1 tw-border tw-rounded tw-text-xs"
      style={{ background: countBackground }}>
      <span data-testid="filter-count">{count}</span>
    </span>
  );
};

export const addToRecentViewed = (eData: RecentlyViewedData): void => {
  const entityData = { ...eData, timestamp: Date.now() };
  let recentlyViewed: RecentlyViewed = reactLocalStorage.getObject(
    LOCALSTORAGE_RECENTLY_VIEWED
  ) as RecentlyViewed;
  if (recentlyViewed?.data) {
    const arrData = recentlyViewed.data
      .filter((item) => item.fqn !== entityData.fqn)
      .sort(
        arraySorterByKey('timestamp', true) as (
          a: RecentlyViewedData,
          b: RecentlyViewedData
        ) => number
      );
    arrData.unshift(entityData);

    if (arrData.length > 5) {
      arrData.pop();
    }
    recentlyViewed.data = arrData;
  } else {
    recentlyViewed = {
      data: [entityData],
    };
  }
  reactLocalStorage.setObject(LOCALSTORAGE_RECENTLY_VIEWED, recentlyViewed);
};

export const getRecentlyViewedData = (): Array<RecentlyViewedData> => {
  const recentlyViewed: RecentlyViewed = reactLocalStorage.getObject(
    LOCALSTORAGE_RECENTLY_VIEWED
  ) as RecentlyViewed;

  if (recentlyViewed?.data) {
    return recentlyViewed.data;
  }

  return [];
};
