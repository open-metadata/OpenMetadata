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

import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { isString, isUndefined, startCase, uniqueId } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppState from '../../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { ROUTES } from '../../../constants/constants';
import { EntityType, FqnPart } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CurrentTourPageType } from '../../../enums/tour.enum';
import { OwnerType } from '../../../enums/user.enum';
import {
  getEntityId,
  getEntityName,
  getEntityPlaceHolder,
  getOwnerValue,
  getPartialNameFromTableFQN,
} from '../../../utils/CommonUtils';
import { serviceTypeLogo } from '../../../utils/ServiceUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { getEntityLink } from '../../../utils/TableUtils';
import { SearchedDataProps } from '../../searched-data/SearchedData.interface';
import './TableDataCard.style.css';
import TableDataCardBody from './TableDataCardBody';

export interface TableDataCardProps {
  id: string;
  source: SearchedDataProps['data'][number]['_source'];
  matches?: {
    key: string;
    value: number;
  }[];
  searchIndex: SearchIndex | EntityType;
}

const TableDataCard: React.FC<TableDataCardProps> = ({
  id,
  source,
  matches,
  searchIndex,
}) => {
  const location = useLocation();

  const tierDisplayName = (() => {
    if (isUndefined(source.tier)) {
      return '';
    }
    if (isString(source.tier)) {
      return source.tier;
    }

    return source.tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1];
  })();

  const otherDetails: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value: getOwnerValue(source.owner),
      placeholderText: getEntityPlaceHolder(
        getEntityName(source.owner),
        source.owner?.deleted
      ),
      id: getEntityId(source.owner),
      isEntityDetails: true,
      isLink: true,
      openInNewTab: false,
      profileName:
        source.owner?.type === OwnerType.USER ? source.owner?.name : undefined,
    },
    { key: 'Tier', value: tierDisplayName },
  ];

  if ('usageSummary' in source) {
    otherDetails.push({
      key: 'Usage',
      value: source.usageSummary?.weeklyStats?.count, // Table, dashboard, mlmodel
    });
  }

  if ('tableType' in source) {
    otherDetails.push({
      key: 'Type',
      value: source.tableType,
      showLabel: true,
    });
  }

  const handleLinkClick = () => {
    if (location.pathname.includes(ROUTES.TOUR)) {
      AppState.currentTourPage = CurrentTourPageType.DATASET_PAGE;
    }
  };

  const getTableMetaInfo = () => {
    if ('databaseSchema' in source && 'database' in source) {
      return (
        <span
          className="tw-text-grey-muted tw-text-xs tw-mb-0.5"
          data-testid="database-schema">{`${source.database?.name}${FQN_SEPARATOR_CHAR}${source.databaseSchema?.name}`}</span>
      );
    } else {
      return null;
    }
  };

  const RenderTitle = useMemo(() => {
    const title = (
      <button
        className="tw-text-grey-body tw-font-semibold"
        data-testid={`${getPartialNameFromTableFQN(
          source.fullyQualifiedName ?? '',
          [FqnPart.Service]
        )}-${getPartialNameFromTableFQN(source.fullyQualifiedName ?? '', [
          FqnPart.Table,
        ])}`}
        id={`${id}Title`}
        onClick={handleLinkClick}>
        {stringToHTML(source.name)}
      </button>
    );

    if (location.pathname.includes(ROUTES.TOUR)) {
      return title;
    }

    return (
      <Link to={getEntityLink(searchIndex, source.fullyQualifiedName ?? '')}>
        {title}
      </Link>
    );
  }, []);

  return (
    <div
      className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
      data-testid="table-data-card">
      <div>
        {getTableMetaInfo()}
        <div className="tw-flex tw-items-center">
          <img
            alt=""
            className="tw-inline tw-h-5"
            src={serviceTypeLogo(source.serviceType || '')}
          />
          <h6 className="tw-flex tw-items-center tw-m-0 tw-text-base tw-pl-2">
            {RenderTitle}
          </h6>
          {source.deleted && (
            <>
              <div
                className="tw-rounded tw-bg-error-lite tw-text-error tw-text-xs tw-font-medium tw-h-5 tw-px-1.5 tw-py-0.5 tw-ml-2"
                data-testid="deleted">
                <FontAwesomeIcon
                  className="tw-mr-1"
                  icon={faExclamationCircle}
                />
                Deleted
              </div>
            </>
          )}
        </div>
      </div>
      <div className="tw-pt-3">
        <TableDataCardBody
          description={source.description || ''}
          extraInfo={otherDetails}
          tags={source.tags}
        />
      </div>
      {matches && matches.length > 0 ? (
        <div className="tw-pt-2" data-testid="matches-stats">
          <span className="tw-text-grey-muted">Matches :</span>
          {matches.map((data, i) => (
            <span className="tw-ml-2" key={uniqueId()}>
              {`${data.value} in ${startCase(data.key)}${
                i !== matches.length - 1 ? ',' : ''
              }`}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default TableDataCard;
