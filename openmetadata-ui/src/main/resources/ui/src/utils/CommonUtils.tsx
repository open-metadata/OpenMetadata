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

/* eslint-disable @typescript-eslint/ban-types */

import { CheckOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import {
  getDayCron,
  getHourCron,
} from 'components/common/CronEditor/CronEditor.constant';
import ErrorPlaceHolder from 'components/common/error-with-placeholder/ErrorPlaceHolder';
import Loader from 'components/Loader/Loader';
import { t } from 'i18next';
import {
  capitalize,
  get,
  isEmpty,
  isNil,
  isNull,
  isString,
  isUndefined,
  toNumber,
} from 'lodash';
import {
  CurrentState,
  ExtraInfo,
  FormattedTableData,
  RecentlySearched,
  RecentlySearchedData,
  RecentlyViewed,
  RecentlyViewedData,
} from 'Models';
import React from 'react';
import { Trans } from 'react-i18next';
import { reactLocalStorage } from 'reactjs-localstorage';
import { getFeedCount } from 'rest/feedsAPI';
import AppState from '../AppState';
import { AddIngestionState } from '../components/AddIngestion/addIngestion.interface';
import { FQN_SEPARATOR_CHAR } from '../constants/char.constants';
import {
  getTeamAndUserDetailsPath,
  getUserPath,
  imageTypes,
  LOCALSTORAGE_RECENTLY_SEARCHED,
  LOCALSTORAGE_RECENTLY_VIEWED,
} from '../constants/constants';
import {
  UrlEntityCharRegEx,
  validEmailRegEx,
} from '../constants/regex.constants';
import { SIZE } from '../enums/common.enum';
import { EntityType, FqnPart, TabSpecificField } from '../enums/entity.enum';
import { FilterPatternEnum } from '../enums/filterPattern.enum';
import { ThreadTaskStatus, ThreadType } from '../generated/entity/feed/thread';
import { PipelineType } from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { EntityReference } from '../generated/entity/teams/user';
import { Paging } from '../generated/type/paging';
import { TagLabel } from '../generated/type/tagLabel';
import { EntityFieldThreadCount } from '../interface/feed.interface';
import jsonData from '../jsons/en';
import { getEntityFeedLink, getTitleCase } from './EntityUtils';
import Fqn from './Fqn';
import { serviceTypeLogo } from './ServiceUtils';
import { getTierFromSearchTableTags } from './TableUtils';
import { TASK_ENTITIES } from './TasksUtils';
import { showErrorToast } from './ToastUtils';

export const arraySorterByKey = <T extends object>(
  key: keyof T,
  sortDescending = false
) => {
  const sortOrder = sortDescending ? -1 : 1;

  return (elementOne: T, elementTwo: T) => {
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

export const getPartialNameFromFQN = (
  fqn: string,
  arrTypes: Array<'service' | 'database' | 'table' | 'column'> = [],
  joinSeperator = '/'
): string => {
  const arrFqn = Fqn.split(fqn);
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
  fqnParts: Array<FqnPart> = [],
  joinSeparator = '/'
): string => {
  if (!fqn) {
    return '';
  }
  const splitFqn = Fqn.split(fqn);
  // if nested column is requested, then ignore all the other
  // parts and just return the nested column name
  if (fqnParts.includes(FqnPart.NestedColumn)) {
    // Remove the first 4 parts (service, database, schema, table)

    return splitFqn.slice(4).join(FQN_SEPARATOR_CHAR);
  }
  const arrPartialName = [];
  if (splitFqn.length > 0) {
    if (fqnParts.includes(FqnPart.Service)) {
      arrPartialName.push(splitFqn[0]);
    }
    if (fqnParts.includes(FqnPart.Database) && splitFqn.length > 1) {
      arrPartialName.push(splitFqn[1]);
    }
    if (fqnParts.includes(FqnPart.Schema) && splitFqn.length > 2) {
      arrPartialName.push(splitFqn[2]);
    }
    if (fqnParts.includes(FqnPart.Table) && splitFqn.length > 3) {
      arrPartialName.push(splitFqn[3]);
    }
    if (fqnParts.includes(FqnPart.Column) && splitFqn.length > 4) {
      arrPartialName.push(splitFqn[4]);
    }
  }

  return arrPartialName.join(joinSeparator);
};

export const getTableFQNFromColumnFQN = (columnFQN: string): string => {
  return getPartialNameFromTableFQN(
    columnFQN,
    [FqnPart.Service, FqnPart.Database, FqnPart.Schema, FqnPart.Table],
    '.'
  );
};

export const getCurrentUserId = (): string => {
  const currentUser = AppState.getCurrentUserDetails();

  return currentUser?.id || '';
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
      return `${countString} ${noun}${count > 1 ? suffix : ''}`;
    }
  }
};

export const hasEditAccess = (type: string, id: string) => {
  const loggedInUser = AppState.getCurrentUserDetails();
  if (type === 'user') {
    return id === loggedInUser?.id;
  } else {
    return Boolean(
      loggedInUser?.teams?.length &&
        loggedInUser?.teams?.some((team) => team.id === id)
    );
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
        'tw-py-px tw-px-1 tw-mx-1 tw-border tw-rounded tw-text-xs tw-min-w-badgeCount tw-text-center',
        clsBG,
        className
      )}>
      <span data-testid="filter-count" title={count.toString()}>
        {count}
      </span>
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
        // search term is not case-insensitive.
        .filter((item) => item.term !== searchData.term)
        .sort(arraySorterByKey<RecentlySearchedData>('timestamp', true));
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
      .sort(arraySorterByKey<RecentlyViewedData>('timestamp', true));
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

export const isValidUrl = (href?: string) => {
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

/**
 *
 * @param email - email address string
 * @returns - True|False
 */
export const isValidEmail = (email?: string) => {
  let isValid = false;
  if (email && email.match(validEmailRegEx)) {
    isValid = true;
  }

  return isValid;
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

export const getEntityMissingError = (entityType: string, fqn: string) => {
  return (
    <p>
      {capitalize(entityType)} {t('label.instance-lowercase')}{' '}
      {t('label.for-lowercase')} <strong>{fqn}</strong>{' '}
      {t('label.not-found-lowercase')}
    </p>
  );
};

export const getNameFromFQN = (fqn: string): string => {
  let arr: string[] = [];

  // Check for fqn containing name inside double quotes which can contain special characters such as '/', '.' etc.
  // Example: sample_data.example_table."example.sample/fqn"

  // Regular expression which matches pattern like '."some content"' at the end of string
  // Example in string 'sample_data."example_table"."example.sample/fqn"',
  // this regular expression  will match '."example.sample/fqn"'
  const regexForQuoteInFQN = /(\."[^"]+")$/g;

  if (regexForQuoteInFQN.test(fqn)) {
    arr = fqn.split('"');

    return arr[arr.length - 2];
  }

  arr = fqn.split(FQN_SEPARATOR_CHAR);

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
    label = getPartialNameFromTableFQN(fqn, [FqnPart.Table]);
  } else {
    label = getPartialNameFromFQN(fqn, ['database']);
  }

  if (withQuotes) {
    return label;
  } else {
    return label.replace(/(^"|"$)/g, '');
  }
};

/**
 * Check if entity is deleted and return with "(Deactivated) text"
 * @param value - entity name
 * @param isDeleted - boolean
 * @returns - entity placeholder
 */
export const getEntityPlaceHolder = (value: string, isDeleted?: boolean) => {
  if (isDeleted) {
    return `${value} (${t('label.deactivated')})`;
  } else {
    return value;
  }
};

export const getEntityDeleteMessage = (entity: string, dependents: string) => {
  if (dependents) {
    return t('message.permanently-delete-metadata-and-dependents', {
      entityName: getTitleCase(entity),
      dependents,
    });
  } else {
    return t('message.permanently-delete-metadata', {
      entityName: getTitleCase(entity),
    });
  }
};

export const replaceSpaceWith_ = (text: string) => {
  return text.replace(/\s/g, '_');
};

export const replaceAllSpacialCharWith_ = (text: string) => {
  return text.replaceAll(/[&/\\#, +()$~%.'":*?<>{}]/g, '_');
};

export const getFeedCounts = (
  entityType: string,
  entityFQN: string,
  conversationCallback: (
    value: React.SetStateAction<EntityFieldThreadCount[]>
  ) => void,
  taskCallback: (value: React.SetStateAction<EntityFieldThreadCount[]>) => void,
  entityCallback: (value: React.SetStateAction<number>) => void
) => {
  // To get conversation count
  getFeedCount(
    getEntityFeedLink(entityType, entityFQN),
    ThreadType.Conversation
  )
    .then((res) => {
      if (res) {
        conversationCallback(res.counts);
      } else {
        throw jsonData['api-error-messages']['fetch-entity-feed-count-error'];
      }
    })
    .catch((err: AxiosError) => {
      showErrorToast(
        err,
        jsonData['api-error-messages']['fetch-entity-feed-count-error']
      );
    });

  // To get open tasks count
  getFeedCount(
    getEntityFeedLink(entityType, entityFQN),
    ThreadType.Task,
    ThreadTaskStatus.Open
  )
    .then((res) => {
      if (res) {
        taskCallback(res.counts);
      } else {
        throw jsonData['api-error-messages']['fetch-entity-feed-count-error'];
      }
    })
    .catch((err: AxiosError) => {
      showErrorToast(
        err,
        jsonData['api-error-messages']['fetch-entity-feed-count-error']
      );
    });

  // To get all thread count (task + conversation)
  getFeedCount(getEntityFeedLink(entityType, entityFQN))
    .then((res) => {
      if (res) {
        entityCallback(res.totalCount);
      } else {
        throw jsonData['api-error-messages']['fetch-entity-feed-count-error'];
      }
    })
    .catch((err: AxiosError) => {
      showErrorToast(
        err,
        jsonData['api-error-messages']['fetch-entity-feed-count-error']
      );
    });
};

/**
 *
 * @param entityType type of the entity
 * @returns true if entity type exists in TASK_ENTITIES otherwise false
 */
export const isTaskSupported = (entityType: EntityType) =>
  TASK_ENTITIES.includes(entityType);

/**
 * Utility function to show pagination
 * @param paging paging object
 * @returns boolean
 */
export const showPagination = (paging: Paging) => {
  return !isNil(paging.after) || !isNil(paging.before);
};

export const formatNumberWithComma = (number: number) => {
  return new Intl.NumberFormat('en-US').format(number);
};

/**
 * If the number is a time format, return the number, otherwise format the number with commas
 * @param {number} number - The number to be formatted.
 * @returns A function that takes a number and returns a string.
 */
export const getStatisticsDisplayValue = (
  number: string | number | undefined
) => {
  const displayValue = toNumber(number);

  if (isNaN(displayValue)) {
    return number;
  }

  return formatNumberWithComma(displayValue);
};

export const formTwoDigitNmber = (number: number) => {
  return number.toLocaleString('en-US', {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
};

export const digitFormatter = (value: number) => {
  // convert 1000 to 1k
  return Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
};

export const getTeamsUser = (
  data?: ExtraInfo
): Record<string, string | undefined> | undefined => {
  if (!isUndefined(data) && !isEmpty(data?.placeholderText || data?.id)) {
    const currentUser = AppState.getCurrentUserDetails();
    const teams = currentUser?.teams;

    const dataFound = teams?.find((team) => {
      return data.id === team.id;
    });

    if (dataFound) {
      return {
        ownerName: (currentUser?.displayName || currentUser?.name) as string,
        id: currentUser?.id as string,
      };
    }
  }

  return;
};

export const getHostNameFromURL = (url: string) => {
  if (isValidUrl(url)) {
    const domain = new URL(url);

    return domain.hostname;
  } else {
    return '';
  }
};

export const getOwnerValue = (owner: EntityReference) => {
  switch (owner?.type) {
    case 'team':
      return getTeamAndUserDetailsPath(owner?.name || '');
    case 'user':
      return getUserPath(owner?.fullyQualifiedName ?? '');
    default:
      return '';
  }
};

export const getIngestionFrequency = (pipelineType: PipelineType) => {
  const value = {
    min: 0,
    hour: 0,
  };

  switch (pipelineType) {
    case PipelineType.TestSuite:
    case PipelineType.Metadata:
      return getHourCron(value);

    default:
      return getDayCron(value);
  }
};

export const getEmptyPlaceholder = () => {
  return (
    <ErrorPlaceHolder size={SIZE.MEDIUM}>
      <Typography.Paragraph>
        {t('message.no-data-available')}
      </Typography.Paragraph>
    </ErrorPlaceHolder>
  );
};

//  return the status like loading and success
export const getLoadingStatus = (
  current: CurrentState,
  id: string | undefined,
  displayText: string
) => {
  return current.id === id ? (
    current.state === 'success' ? (
      <CheckOutlined />
    ) : (
      <Loader size="small" type="default" />
    )
  ) : (
    displayText
  );
};

export const refreshPage = () => window.location.reload();
// return array of id as  strings
export const getEntityIdArray = (entities: EntityReference[]): string[] =>
  entities.map((item) => item.id);

export const getEntityFqnArray = (entities: EntityReference[]): string[] =>
  entities.map((item) => item.fullyQualifiedName!);

export const getTierFromEntityInfo = (entity: FormattedTableData) => {
  return (
    entity.tier?.tagFQN ||
    getTierFromSearchTableTags((entity.tags || []).map((tag) => tag.tagFQN))
  )?.split(FQN_SEPARATOR_CHAR)[1];
};

export const getTagValue = (tag: string | TagLabel): string | TagLabel => {
  if (isString(tag)) {
    return tag.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)
      ? tag.split(FQN_SEPARATOR_CHAR)[1]
      : tag;
  } else {
    return {
      ...tag,
      tagFQN: tag.tagFQN.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)
        ? tag.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
        : tag.tagFQN,
    };
  }
};

export const getTrimmedContent = (content: string, limit: number) => {
  const lines = content.split('\n');
  // Selecting the content in three lines
  const contentInThreeLines = lines.slice(0, 3).join('\n');

  const slicedContent = contentInThreeLines.slice(0, limit);

  // Logic for eliminating any broken words at the end
  // To avoid any URL being cut
  const words = slicedContent.split(' ');
  const wordsCount = words.length;

  if (wordsCount === 1) {
    // In case of only one word (possibly too long URL)
    // return the whole word instead of trimming
    return content.split(' ')[0];
  }

  // Eliminate word at the end to avoid using broken words
  const refinedContent = words.slice(0, wordsCount - 1);

  return refinedContent.join(' ');
};

export const sortTagsCaseInsensitive = (tags: TagLabel[]) => {
  return tags.sort((tag1, tag2) =>
    tag1.tagFQN.toLowerCase() < tag2.tagFQN.toLowerCase() ? -1 : 1
  );
};

export const Transi18next = ({
  i18nKey,
  values,
  renderElement,
  ...otherProps
}: {
  i18nKey: string;
  values?: object;
  renderElement: JSX.Element | HTMLElement;
}): JSX.Element => (
  <Trans i18nKey={i18nKey} values={values} {...otherProps}>
    {renderElement}
  </Trans>
);

/**
 * It returns a link to the documentation for the given filter pattern type
 * @param {FilterPatternEnum} type - The type of filter pattern.
 * @returns A string
 */
export const getFilterPatternDocsLinks = (type: FilterPatternEnum) => {
  switch (type) {
    case FilterPatternEnum.DATABASE:
    case FilterPatternEnum.SCHEMA:
    case FilterPatternEnum.TABLE:
      return `https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns/${FilterPatternEnum.DATABASE}#${type}-filter-pattern`;

    case FilterPatternEnum.DASHBOARD:
    case FilterPatternEnum.CHART:
      return 'https://docs.open-metadata.org/connectors/dashboard/metabase#6-configure-metadata-ingestion';

    case FilterPatternEnum.TOPIC:
      return 'https://docs.open-metadata.org/connectors/messaging/kafka#6-configure-metadata-ingestion';

    case FilterPatternEnum.PIPELINE:
      return 'https://docs.open-metadata.org/connectors/pipeline/airflow#6-configure-metadata-ingestion';

    case FilterPatternEnum.MLMODEL:
      return 'https://docs.open-metadata.org/connectors/ml-model/mlflow';

    default:
      return 'https://docs.open-metadata.org/connectors/ingestion/workflows/metadata/filter-patterns';
  }
};

/**
 * It takes a string and returns a string
 * @param {FilterPatternEnum} type - FilterPatternEnum
 * @returns A function that takes in a type and returns a keyof AddIngestionState
 */
export const getFilterTypes = (
  type: FilterPatternEnum
): keyof AddIngestionState => {
  switch (type) {
    case FilterPatternEnum.CHART:
      return 'chartFilterPattern' as keyof AddIngestionState;
    case FilterPatternEnum.DASHBOARD:
      return 'dashboardFilterPattern' as keyof AddIngestionState;
    case FilterPatternEnum.DATABASE:
      return 'databaseFilterPattern' as keyof AddIngestionState;
    case FilterPatternEnum.MLMODEL:
      return 'mlModelFilterPattern' as keyof AddIngestionState;
    case FilterPatternEnum.PIPELINE:
      return 'pipelineFilterPattern' as keyof AddIngestionState;
    case FilterPatternEnum.SCHEMA:
      return 'schemaFilterPattern' as keyof AddIngestionState;
    case FilterPatternEnum.TABLE:
      return 'tableFilterPattern' as keyof AddIngestionState;
    default:
      return 'topicFilterPattern' as keyof AddIngestionState;
  }
};

/**
 * It takes a state and an action, and returns a new state with the action merged into it
 * @param {S} state - S - The current state of the reducer.
 * @param {A} action - A - The action that was dispatched.
 * @returns An object with the state and action properties.
 */
export const reducerWithoutAction = <S, A>(state: S, action: A) => {
  return {
    ...state,
    ...action,
  };
};

/**
 * @param text plain text
 * @returns base64 encoded text
 */
export const getBase64EncodedString = (text: string): string => btoa(text);

export const getIsErrorMatch = (error: AxiosError, key: string): boolean => {
  let errorMessage = '';

  if (error) {
    errorMessage = get(error, 'response.data.message', '');
    if (!errorMessage) {
      // if error text is undefined or null or empty, try responseMessage in data
      errorMessage = get(error, 'response.data.responseMessage', '');
    }
    if (!errorMessage) {
      errorMessage = get(error, 'response.data', '');
      errorMessage = typeof errorMessage === 'string' ? errorMessage : '';
    }
  }

  return errorMessage.includes(key);
};
