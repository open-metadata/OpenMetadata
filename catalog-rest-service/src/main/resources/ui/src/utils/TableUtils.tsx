import { ColumnTags, TableDetail } from 'Models';
import React from 'react';
import AppState from '../AppState';
import PopOver from '../components/common/popover/PopOver';
import {
  getDatasetDetailsPath,
  getTopicDetailsPath,
} from '../constants/constants';
import { SearchIndex } from '../enums/search.enum';
import { ConstraintTypes } from '../enums/table.enum';
import { ordinalize } from './StringsUtils';
import SVGIcons from './SvgUtils';

export const getBadgeName = (tableType?: string) => {
  switch (tableType) {
    case 'REGULAR':
      return 'table';
    case 'QUERY':
      return 'query';
    default:
      return 'table';
  }
};

export const usageSeverity = (value: number): string => {
  if (value > 75) {
    return 'High';
  } else if (value >= 25 && value <= 75) {
    return 'Medium';
  } else {
    return 'Low';
  }
};

export const getUsagePercentile = (pctRank: number) => {
  const percentile = Math.round(pctRank * 10) / 10;
  const ordinalPercentile = ordinalize(percentile);
  const strSeverity = usageSeverity(percentile);
  const usagePercentile = `${strSeverity} - ${ordinalPercentile} pctile`;

  return usagePercentile;
};

export const getTierFromTableTags = (
  tags: Array<ColumnTags>
): ColumnTags['tagFQN'] => {
  const tierTag = tags.find(
    (item) =>
      item.tagFQN.startsWith('Tier.Tier') &&
      !isNaN(parseInt(item.tagFQN.substring(9).trim()))
  );

  return tierTag?.tagFQN || '';
};

export const getTagsWithoutTier = (
  tags: Array<ColumnTags>
): Array<ColumnTags> => {
  return tags.filter(
    (item) =>
      !item.tagFQN.startsWith('Tier.Tier') ||
      isNaN(parseInt(item.tagFQN.substring(9).trim()))
  );
};

export const getTierFromSearchTableTags = (tags: Array<string>): string => {
  const tierTag = tags.find(
    (item) =>
      item.startsWith('Tier.Tier') && !isNaN(parseInt(item.substring(9).trim()))
  );

  return tierTag || '';
};

export const getSearchTableTagsWithoutTier = (
  tags: Array<string>
): Array<string> => {
  return tags.filter(
    (item) =>
      !item.startsWith('Tier.Tier') || isNaN(parseInt(item.substring(9).trim()))
  );
};

export const getOwnerFromId = (
  id?: string
): TableDetail['owner'] | undefined => {
  let retVal: TableDetail['owner'];
  if (id) {
    const user = AppState.users.find((item) => item.id === id);
    if (user) {
      retVal = {
        name: user.displayName,
        id: user.id,
        type: 'user',
      };
    } else {
      const team = AppState.userTeams.find((item) => item.id === id);
      if (team) {
        retVal = {
          name: team.displayName || team.name,
          id: team.id,
          type: 'team',
        };
      }
    }
  }

  return retVal;
};

export const getConstraintIcon = (constraint = '') => {
  let title: string, icon: string;
  switch (constraint) {
    case ConstraintTypes.PRIMARY_KEY:
      {
        title = 'Primary key';
        icon = 'key';
      }

      break;
    case ConstraintTypes.UNIQUE:
      {
        title = 'Unique';
        icon = 'unique';
      }

      break;
    case ConstraintTypes.NOT_NULL:
      {
        title = 'Not null';
        icon = 'not-null';
      }

      break;
    default:
      return null;
  }

  return (
    <PopOver
      className="tw-absolute tw-left-2"
      position="bottom"
      size="small"
      title={title}
      trigger="mouseenter">
      <SVGIcons alt={title} icon={icon} width="12px" />
    </PopOver>
  );
};

export const getEntityLink = (
  indexType: string,
  fullyQualifiedName: string
) => {
  switch (indexType) {
    case SearchIndex.TOPIC:
      return getTopicDetailsPath(fullyQualifiedName);

    case SearchIndex.TABLE:
    default:
      return getDatasetDetailsPath(fullyQualifiedName);
  }
};
