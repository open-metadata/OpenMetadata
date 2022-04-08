/*
 *  Copyright 2021 Collate
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

import classNames from 'classnames';
import { capitalize, isEmpty, isNull, isUndefined } from 'lodash';
import {
  RecentlySearched,
  RecentlySearchedData,
  RecentlyViewed,
  RecentlyViewedData,
} from 'Models';
import { utc } from 'moment';
import React, { FormEvent } from 'react';
import { reactLocalStorage } from 'reactjs-localstorage';
import AppState from '../AppState';
import { Button } from '../components/buttons/Button/Button';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  imageTypes,
  LOCALSTORAGE_RECENTLY_SEARCHED,
  LOCALSTORAGE_RECENTLY_VIEWED,
  TITLE_FOR_NON_OWNER_ACTION,
} from '../constants/constants';
import { FQN_REGEX, UrlEntityCharRegEx } from '../constants/regex.constants';
import { EntityType, TabSpecificField } from '../enums/entity.enum';
import { Ownership } from '../enums/mydata.enum';
import {
  EntityReference,
  EntityReference as UserTeams,
  User,
} from '../generated/entity/teams/user';
import { serviceTypeLogo } from './ServiceUtils';
import SVGIcons, { Icons } from './SvgUtils';

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
  const arrColFQN = columnFQN.split(FQN_SEPARATOR_CHAR);

  return arrColFQN.slice(0, arrColFQN.length - 1).join(FQN_SEPARATOR_CHAR);
};

export const getPartialNameFromFQN = (
  fqn: string,
  arrTypes: Array<'service' | 'database' | 'table' | 'column'> = [],
  joinSeperator = '/'
): string => {
  const arrFqn = fqn.split(FQN_SEPARATOR_CHAR);
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
export const getPartialNameFromTableFQN = (
  fqn: string,
  arrTypes: Array<'service' | 'database' | 'schema' | 'table' | 'column'> = [],
  joinSeperator = '/'
): string => {
  const arrFqn = fqn.match(FQN_REGEX) || [];
  const arrPartialName = [];
  for (const type of arrTypes) {
    if (type === 'service' && arrFqn.length > 0) {
      arrPartialName.push(arrFqn[0]);
    } else if (type === 'database' && arrFqn.length > 1) {
      arrPartialName.push(arrFqn[1]);
    } else if (type === 'schema' && arrFqn.length > 2) {
      arrPartialName.push(arrFqn[2]);
    } else if (type === 'table' && arrFqn.length > 3) {
      arrPartialName.push(arrFqn[3]);
    } else if (type === 'column' && arrFqn.length > 4) {
      arrPartialName.push(arrFqn[4]);
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
  const countString = count.toLocaleString();
  if (count !== 1 && count !== 0 && !noun.endsWith(suffix)) {
    return `${countString} ${noun}${suffix}`;
  } else {
    if (noun.endsWith(suffix)) {
      return `${countString} ${
        count > 1 ? noun : noun.slice(0, noun.length - 1)
      }`;
    } else {
      return `${countString} ${noun}${count !== 1 ? suffix : ''}`;
    }
  }
};

export const getUserTeams = (): Array<UserTeams> => {
  let retVal: Array<UserTeams>;
  if (AppState.userDetails.teams) {
    retVal = AppState.userDetails.teams.map((item) => {
      const team = AppState.userTeams.find((obj) => obj.id === item.id);

      return { ...item, displayName: team?.displayName };
    });
  } else {
    retVal = AppState.userTeams;
  }

  return retVal || [];
};

export const hasEditAccess = (type: string, id: string) => {
  if (type === 'user') {
    return id === getCurrentUserId();
  } else {
    return getUserTeams().some((team) => team.id === id);
  }
};

export const getTabClasses = (
  tab: number | string,
  activeTab: number | string
) => {
  return 'tw-gh-tabs' + (activeTab === tab ? ' active' : '');
};

export const getCountBadge = (
  count = 0,
  className = '',
  isActive?: boolean
) => {
  const clsBG = isUndefined(isActive)
    ? ''
    : isActive
    ? 'tw-bg-primary tw-text-white tw-border-none'
    : 'tw-bg-badge';

  return (
    <span
      className={classNames(
        'tw-py-px tw-px-1 tw-ml-1 tw-border tw-rounded tw-text-xs tw-min-w-badgeCount tw-text-center',
        clsBG,
        className
      )}>
      <span data-testid="filter-count">{count}</span>
    </span>
  );
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

export const getRecentlySearchedData = (): Array<RecentlySearchedData> => {
  const recentlySearch: RecentlySearched = reactLocalStorage.getObject(
    LOCALSTORAGE_RECENTLY_SEARCHED
  ) as RecentlySearched;
  if (recentlySearch?.data) {
    return recentlySearch.data;
  }

  return [];
};

export const setRecentlyViewedData = (
  recentData: Array<RecentlyViewedData>
): void => {
  reactLocalStorage.setObject(LOCALSTORAGE_RECENTLY_VIEWED, {
    data: recentData,
  });
};

export const setRecentlySearchedData = (
  recentData: Array<RecentlySearchedData>
): void => {
  reactLocalStorage.setObject(LOCALSTORAGE_RECENTLY_SEARCHED, {
    data: recentData,
  });
};

export const addToRecentSearched = (searchTerm: string): void => {
  if (searchTerm.trim()) {
    const searchData = { term: searchTerm, timestamp: Date.now() };
    const recentlySearch: RecentlySearched = reactLocalStorage.getObject(
      LOCALSTORAGE_RECENTLY_SEARCHED
    ) as RecentlySearched;
    let arrSearchedData: RecentlySearched['data'] = [];
    if (recentlySearch?.data) {
      const arrData = recentlySearch.data
        // search term is not case-insensetive.
        .filter((item) => item.term !== searchData.term)
        .sort(
          arraySorterByKey('timestamp', true) as (
            a: RecentlySearchedData,
            b: RecentlySearchedData
          ) => number
        );
      arrData.unshift(searchData);

      if (arrData.length > 5) {
        arrData.pop();
      }
      arrSearchedData = arrData;
    } else {
      arrSearchedData = [searchData];
    }
    setRecentlySearchedData(arrSearchedData);
  }
};

export const removeRecentSearchTerm = (searchTerm: string) => {
  const recentlySearch: RecentlySearched = reactLocalStorage.getObject(
    LOCALSTORAGE_RECENTLY_SEARCHED
  ) as RecentlySearched;
  if (recentlySearch?.data) {
    const arrData = recentlySearch.data.filter(
      (item) => item.term !== searchTerm
    );
    setRecentlySearchedData(arrData);
  }
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
  setRecentlyViewedData(recentlyViewed.data);
};

export const getHtmlForNonAdminAction = (isClaimOwner: boolean) => {
  return (
    <>
      <p>{TITLE_FOR_NON_OWNER_ACTION}</p>
      {!isClaimOwner ? <p>Claim ownership in Manage </p> : null}
    </>
  );
};

export const getOwnerIds = (
  filter: Ownership,
  userDetails: User
): Array<string> => {
  if (filter === Ownership.OWNER && userDetails.teams) {
    const userTeams = !isEmpty(userDetails)
      ? userDetails.teams.map((team) => team.id)
      : [];

    return [...userTeams, getCurrentUserId()];
  } else {
    return [getCurrentUserId()];
  }
};

export const getActiveCatClass = (name: string, activeName = '') => {
  return activeName === name ? 'activeCategory' : '';
};

export const errorMsg = (value: string) => {
  return (
    <div className="tw-mt-1">
      <strong
        className="tw-text-red-500 tw-text-xs tw-italic"
        data-testid="error-message">
        {value}
      </strong>
    </div>
  );
};

export const validMsg = (value: string) => {
  return (
    <div className="tw-mt-1">
      <strong
        className="tw-text-success tw-text-xs tw-italic"
        data-testid="error-message">
        {value}
      </strong>
    </div>
  );
};

export const requiredField = (label: string, excludeSpace = false) => (
  <>
    {label}{' '}
    <span className="tw-text-red-500">{!excludeSpace && <>&nbsp;</>}*</span>
  </>
);

export const getSeparator = (
  title: string | JSX.Element,
  hrMarginTop = 'tw-mt-2.5'
) => {
  return (
    <span className="tw-flex tw-py-2 tw-text-grey-muted">
      <hr className={classNames('tw-w-full', hrMarginTop)} />
      {title && <span className="tw-px-0.5 tw-min-w-max">{title}</span>}
      <hr className={classNames('tw-w-full', hrMarginTop)} />
    </span>
  );
};

export const getImages = (imageUri: string) => {
  const imagesObj: typeof imageTypes = imageTypes;
  for (const type in imageTypes) {
    imagesObj[type as keyof typeof imageTypes] = imageUri.replace(
      's96-c',
      imageTypes[type as keyof typeof imageTypes]
    );
  }

  return imagesObj;
};

export const getServiceLogo = (
  serviceType: string,
  className = ''
): JSX.Element | null => {
  const logo = serviceTypeLogo(serviceType);

  if (!isNull(logo)) {
    return <img alt="" className={className} src={logo} />;
  }

  return null;
};

export const getCurrentDate = () => {
  return `${utc(new Date()).format('YYYY-MM-DD')}`;
};

export const getSvgArrow = (isActive: boolean) => {
  return isActive ? (
    <SVGIcons alt="arrow-down" icon={Icons.ARROW_DOWN_PRIMARY} />
  ) : (
    <SVGIcons alt="arrow-right" icon={Icons.ARROW_RIGHT_PRIMARY} />
  );
};

export const isValidUrl = (href: string) => {
  if (!href) {
    return false;
  }
  try {
    const url = new URL(href);

    return Boolean(url.href);
  } catch {
    return false;
  }
};

export const getFields = (defaultFields: string, tabSpecificField: string) => {
  if (!tabSpecificField) {
    return defaultFields;
  }
  if (!defaultFields) {
    return tabSpecificField;
  }
  if (
    tabSpecificField === TabSpecificField.LINEAGE ||
    tabSpecificField === TabSpecificField.ACTIVITY_FEED
  ) {
    return defaultFields;
  }

  return `${defaultFields}, ${tabSpecificField}`;
};

export const restrictFormSubmit = (e: FormEvent) => {
  e.preventDefault();
};

export const getEntityMissingError = (entityType: string, fqn: string) => {
  return (
    <p>
      {capitalize(entityType)} instance for <strong>{fqn}</strong> not found
    </p>
  );
};

export const getDocButton = (label: string, url: string, dataTestId = '') => {
  return (
    <Button
      className="tw-group tw-rounded tw-w-full tw-px-3 tw-py-1.5 tw-text-sm"
      data-testid={dataTestId}
      href={url}
      rel="noopener noreferrer"
      size="custom"
      tag="a"
      target="_blank"
      theme="primary"
      variant="outlined">
      <SVGIcons
        alt="Doc icon"
        className="tw-align-middle tw-mr-2 group-hover:tw-hidden"
        icon={Icons.DOC_PRIMARY}
        width="14"
      />
      <SVGIcons
        alt="Doc icon"
        className="tw-align-middle tw-mr-2 tw-hidden group-hover:tw-inline-block"
        icon={Icons.DOC_WHITE}
        width="14"
      />
      <span>{label}</span>
      <SVGIcons
        alt="external-link"
        className="tw-align-middle tw-ml-2 group-hover:tw-hidden"
        icon={Icons.EXTERNAL_LINK}
        width="14"
      />
      <SVGIcons
        alt="external-link"
        className="tw-align-middle tw-ml-2 tw-hidden group-hover:tw-inline-block"
        icon={Icons.EXTERNAL_LINK_WHITE}
        width="14"
      />
    </Button>
  );
};

export const getNameFromFQN = (fqn: string): string => {
  const arr = fqn.split(FQN_SEPARATOR_CHAR);

  return arr[arr.length - 1];
};

export const getRandomColor = (name: string) => {
  const firstAlphabet = name.charAt(0).toLowerCase();
  const asciiCode = firstAlphabet.charCodeAt(0);
  const colorNum =
    asciiCode.toString() + asciiCode.toString() + asciiCode.toString();

  const num = Math.round(0xffffff * parseInt(colorNum));
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return {
    color: 'rgb(' + r + ', ' + g + ', ' + b + ', 0.6)',
    character: firstAlphabet.toUpperCase(),
  };
};

export const isUrlFriendlyName = (value: string) => {
  return !UrlEntityCharRegEx.test(value);
};

/**
 * Take teams data and filter out the non deleted teams
 * @param teams - teams array
 * @returns - non deleted team
 */
export const getNonDeletedTeams = (teams: EntityReference[]) => {
  return teams.filter((t) => !t.deleted);
};

/**
 * prepare label for given entity type and fqn
 * @param type - entity type
 * @param fqn - entity fqn
 * @param withQuotes - boolean value
 * @returns - label for entity
 */
export const prepareLabel = (type: string, fqn: string, withQuotes = true) => {
  let label = '';
  if (type === EntityType.TABLE) {
    label = getPartialNameFromTableFQN(fqn, ['table']);
  } else {
    label = getPartialNameFromFQN(fqn, ['database']);
  }

  if (withQuotes) {
    return label;
  } else {
    return label.replace(/(^"|"$)/g, '');
  }
};
