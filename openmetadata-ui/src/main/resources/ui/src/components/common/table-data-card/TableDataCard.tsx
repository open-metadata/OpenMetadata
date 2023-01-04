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

import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  isNil,
  isString,
  isUndefined,
  startCase,
  uniqBy,
  uniqueId,
} from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FunctionComponent, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AppState from '../../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { ROUTES } from '../../../constants/constants';
import { FqnPart } from '../../../enums/entity.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { CurrentTourPageType } from '../../../enums/tour.enum';
import { OwnerType } from '../../../enums/user.enum';
import { TableType } from '../../../generated/entity/data/table';
import { EntityReference } from '../../../generated/type/entityReference';
import { TagLabel } from '../../../generated/type/tagLabel';
import {
  getEntityId,
  getEntityName,
  getEntityPlaceHolder,
  getNameFromFQN,
  getOwnerValue,
  getPartialNameFromTableFQN,
} from '../../../utils/CommonUtils';
import { serviceTypeLogo } from '../../../utils/ServiceUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { getEntityLink, getUsagePercentile } from '../../../utils/TableUtils';
import './TableDataCard.style.css';
import TableDataCardBody from './TableDataCardBody';

type Props = {
  name: string;
  owner?: EntityReference;
  description?: string;
  tableType?: TableType;
  id?: string;
  tier?: string | TagLabel;
  usage?: number;
  service?: string;
  serviceType?: string;
  fullyQualifiedName: string;
  tags?: string[] | TagLabel[];
  indexType: string;
  matches?: {
    key: string;
    value: number;
  }[];
  database?: string;
  databaseSchema?: string;
  deleted?: boolean;
};

const TableDataCard: FunctionComponent<Props> = ({
  owner,
  description,
  id,
  tier = '',
  usage,
  serviceType,
  fullyQualifiedName,
  tags,
  indexType,
  matches,
  tableType,
  deleted = false,
  name,
  database,
  databaseSchema,
}: Props) => {
  const location = useLocation();
  const getTier = () => {
    if (tier) {
      return isString(tier) ? tier : tier.tagFQN.split(FQN_SEPARATOR_CHAR)[1];
    }

    return '';
  };

  const OtherDetails: Array<ExtraInfo> = [
    {
      key: 'Owner',
      value: getOwnerValue(owner ?? ({} as EntityReference)),
      placeholderText: getEntityPlaceHolder(
        getEntityName(owner),
        owner?.deleted
      ),
      id: getEntityId(owner),
      isEntityDetails: true,
      isLink: true,
      openInNewTab: false,
      profileName: owner?.type === OwnerType.USER ? owner?.name : undefined,
    },
    { key: 'Tier', value: getTier() },
  ];
  if (indexType !== SearchIndex.DASHBOARD && usage !== undefined) {
    OtherDetails.push({
      key: 'Usage',
      value:
        indexType !== SearchIndex.DASHBOARD && usage !== undefined
          ? getUsagePercentile(usage, true)
          : undefined,
    });
  }
  if (tableType) {
    OtherDetails.push({
      key: 'Type',
      value: tableType,
      showLabel: true,
    });
  }

  const getAssetTags = () => {
    const assetTags = [...(tags as Array<TagLabel>)];
    if (tier && !isUndefined(tier)) {
      assetTags.unshift(tier as TagLabel);
    }

    return [...uniqBy(assetTags, 'tagFQN')];
  };

  const handleLinkClick = () => {
    if (location.pathname.includes(ROUTES.TOUR)) {
      AppState.currentTourPage = CurrentTourPageType.DATASET_PAGE;
    }
  };

  const getTableMetaInfo = () => {
    if (!isNil(database) && !isNil(databaseSchema)) {
      return (
        <span
          className="tw-text-grey-muted tw-text-xs tw-mb-0.5"
          data-testid="database-schema">{`${database}${FQN_SEPARATOR_CHAR}${databaseSchema}`}</span>
      );
    } else {
      return null;
    }
  };

  const RenderTitle = useMemo(() => {
    const title = (
      <button
        className="tw-text-grey-body tw-font-semibold"
        data-testid={`${getPartialNameFromTableFQN(fullyQualifiedName, [
          FqnPart.Service,
        ])}-${getNameFromFQN(fullyQualifiedName)}`}
        id={`${id}Title`}
        onClick={handleLinkClick}>
        {stringToHTML(name)}
      </button>
    );

    if (location.pathname.includes(ROUTES.TOUR)) {
      return title;
    }

    return (
      <Link to={getEntityLink(indexType, fullyQualifiedName)}>{title}</Link>
    );
  }, []);

  return (
    <div
      className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
      data-testid="table-data-card"
      id={id}>
      <div>
        {getTableMetaInfo()}
        <div className="tw-flex tw-items-center">
          <img
            alt=""
            className="tw-inline tw-h-5"
            src={serviceTypeLogo(serviceType || '')}
          />
          <h6 className="tw-flex tw-items-center tw-m-0 tw-text-base tw-pl-2">
            {RenderTitle}
          </h6>
          {deleted && (
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
          description={description || ''}
          extraInfo={OtherDetails}
          tags={getAssetTags()}
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
