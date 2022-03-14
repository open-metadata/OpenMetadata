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

import { isString, isUndefined, startCase, uniqueId } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FunctionComponent } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import AppState from '../../../AppState';
import { ROUTES } from '../../../constants/constants';
import { SearchIndex } from '../../../enums/search.enum';
import { CurrentTourPageType } from '../../../enums/tour.enum';
import { TagLabel } from '../../../generated/type/tagLabel';
import { serviceTypeLogo } from '../../../utils/ServiceUtils';
import { stringToHTML } from '../../../utils/StringsUtils';
import { getEntityLink, getUsagePercentile } from '../../../utils/TableUtils';
import TableDataCardBody from './TableDataCardBody';
import { faExclamationCircle } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

type Props = {
  name: string;
  owner?: string;
  description?: string;
  tableType?: string;
  id?: string;
  tier?: string | TagLabel;
  usage?: number;
  serviceType?: string;
  fullyQualifiedName: string;
  tags?: string[] | TagLabel[];
  indexType: string;
  matches?: {
    key: string;
    value: number;
  }[];
  database?: string;
  deleted?: boolean;
};

const TableDataCard: FunctionComponent<Props> = ({
  name,
  owner = '',
  description,
  id,
  tier = '',
  usage,
  serviceType,
  fullyQualifiedName,
  tags,
  indexType,
  matches,
  database,
  deleted = false,
}: Props) => {
  const location = useLocation();
  const history = useHistory();
  const getTier = () => {
    if (tier) {
      return isString(tier) ? tier : tier.tagFQN.split('.')[1];
    }

    return '';
  };

  const OtherDetails: Array<ExtraInfo> = [
    { key: 'Owner', value: owner },
    // { key: 'Service', value: serviceType },
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
  if (database) {
    OtherDetails.push({
      key: 'Database',
      value: database,
      showLabel: true,
    });
  }
  const getAssetTags = () => {
    const assetTags = [...(tags as Array<TagLabel>)];
    if (tier && !isUndefined(tier)) {
      assetTags.unshift(tier as TagLabel);
    }

    return [...new Set(assetTags)];
  };

  const handleLinkClick = () => {
    if (location.pathname.includes(ROUTES.TOUR)) {
      AppState.currentTourPage = CurrentTourPageType.DATASET_PAGE;
    } else {
      history.push(getEntityLink(indexType, fullyQualifiedName));
    }
  };

  return (
    <div
      className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md"
      data-testid="table-data-card"
      id={id}>
      <div>
        <div className="tw-flex tw-items-center">
          <img
            alt=""
            className="tw-inline tw-h-5 tw-w-5"
            src={serviceTypeLogo(serviceType || '')}
          />
          <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
            <button
              className="tw-text-grey-body tw-font-medium"
              data-testid="table-link"
              id={`${id}Title`}
              onClick={handleLinkClick}>
              {stringToHTML(name)}
            </button>
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
