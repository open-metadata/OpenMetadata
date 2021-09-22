/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosResponse } from 'axios';
import { isEmpty } from 'lodash';
import { observer } from 'mobx-react';
import { TableDetail } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import appState from '../../AppState';
import { getCategory } from '../../axiosAPIs/tagAPI';
import {
  getHtmlForNonAdminAction,
  getUserTeams,
} from '../../utils/CommonUtils';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import CardListItem from '../card-list/CardListItem/CardWithListItems';
import { CardWithListItems } from '../card-list/CardListItem/CardWithListItems.interface';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import DropDownList from '../dropdown/DropDownList';
import Loader from '../Loader/Loader';

type Props = {
  currentTier?: string;
  currentUser?: string;
  onSave: (
    owner: TableDetail['owner'],
    tier: TableDetail['tier']
  ) => Promise<void>;
  hasEditAccess: boolean;
};

const ManageTab: FunctionComponent<Props> = ({
  currentTier = '',
  currentUser = '',
  onSave,
  hasEditAccess,
}: Props) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'initial' | 'waiting' | 'success'>(
    'initial'
  );
  const [activeTier, setActiveTier] = useState(currentTier);
  const [listVisible, setListVisible] = useState(false);

  const [tierData, setTierData] = useState<Array<CardWithListItems>>([]);
  const [listOwners] = useState(() => {
    const user = !isEmpty(appState.userDetails)
      ? appState.userDetails
      : appState.users.length
      ? appState.users[0]
      : undefined;
    const teams = getUserTeams().map((team) => ({
      name: team?.displayName || team.name,
      value: team.id,
      group: 'Teams',
      type: 'team',
    }));

    if (user?.isAdmin) {
      const users = appState.users
        .map((user) => ({
          name: user.displayName,
          value: user.id,
          group: 'Users',
          type: 'user',
        }))
        .filter((u) => u.value != user.id);
      const teams = appState.userTeams.map((team) => ({
        name: team.displayName || team.name,
        value: team.id,
        group: 'Teams',
        type: 'team',
      }));

      return [
        {
          name: user.displayName,
          value: user.id,
          group: 'Users',
          type: 'user',
        },
        ...users,
        ...teams,
      ];
    } else {
      return user
        ? [
            {
              name: user.displayName,
              value: user.id,
              group: 'Users',
              type: 'user',
            },
            ...teams,
          ]
        : teams;
    }
  });
  const [owner, setOwner] = useState(currentUser);
  const [isLoadingTierData, setIsLoadingTierData] = useState<boolean>(false);

  const getOwnerById = (): string => {
    return listOwners.find((item) => item.value === owner)?.name || '';
  };

  const handleOwnerSelection = (
    _e: React.MouseEvent<HTMLElement, MouseEvent>,
    value?: string
  ) => {
    if (value) {
      const newOwner = listOwners.find((item) => item.value === value);
      if (newOwner) {
        setOwner(newOwner.value);
      }
    }
    setListVisible(false);
  };

  const handleCardSelection = (cardId: string) => {
    setActiveTier(cardId);
  };

  const handleSave = () => {
    setLoading(true);
    setStatus('waiting');
    // Save API call goes here...
    const newOwner: TableDetail['owner'] =
      owner !== currentUser
        ? {
            id: owner,
            type: listOwners.find((item) => item.value === owner)?.type as
              | 'user'
              | 'team',
          }
        : undefined;
    const newTier = activeTier !== currentTier ? activeTier : undefined;
    onSave(newOwner, newTier).catch(() => {
      setStatus('initial');
      setLoading(false);
    });
  };

  const handleCancel = () => {
    setActiveTier(currentTier);
    setOwner(currentUser);
  };

  const getTierData = () => {
    setIsLoadingTierData(true);
    getCategory('Tier').then((res: AxiosResponse) => {
      if (res.data) {
        const tierData = res.data.children.map(
          (tier: { name: string; description: string }) => ({
            id: `Tier.${tier.name}`,
            title: tier.name,
            description: tier.description.substring(
              0,
              tier.description.indexOf('\n\n')
            ),
            data: tier.description.substring(
              tier.description.indexOf('\n\n') + 1
            ),
          })
        );

        setTierData(tierData);
        setIsLoadingTierData(false);
      } else {
        setTierData([]);
        setIsLoadingTierData(false);
      }
    });
  };

  useEffect(() => {
    getTierData();
  }, []);

  useEffect(() => {
    setActiveTier(currentTier);
  }, [currentTier]);

  useEffect(() => {
    setOwner(currentUser);
  }, [currentUser]);

  useEffect(() => {
    setTimeout(() => {
      setLoading(false);
    }, 1000);
    if (status === 'waiting') {
      setStatus('success');
      setTimeout(() => {
        setStatus('initial');
      }, 3000);
    }
  }, [currentTier, currentUser]);

  return (
    <div className="tw-max-w-3xl tw-mx-auto" data-testid="manage-tab">
      <div className="tw-mt-2 tw-mb-4 tw-pb-4 tw-border-b tw-border-separator">
        <span className="tw-mr-2">Owner:</span>
        <span className="tw-relative">
          <Button
            className="tw-underline"
            data-testid="owner-dropdown"
            disabled={!listOwners.length}
            size="custom"
            theme="primary"
            variant="link"
            onClick={() => setListVisible((visible) => !visible)}>
            {getOwnerById() || 'Select Owner'}
            <SVGIcons
              alt="edit"
              className="tw-ml-1"
              icon="icon-edit"
              title="Edit"
              width="12px"
            />
          </Button>
          {listVisible && (
            <DropDownList
              showSearchBar
              dropDownList={listOwners}
              listGroups={['Users', 'Teams']}
              value={owner}
              onSelect={handleOwnerSelection}
            />
          )}
        </span>
      </div>
      <div className="tw-flex tw-flex-col" data-testid="cards">
        {isLoadingTierData ? (
          <Loader />
        ) : (
          tierData.map((card, i) => (
            <NonAdminAction
              html={getHtmlForNonAdminAction(Boolean(owner))}
              isOwner={hasEditAccess || Boolean(owner)}
              key={i}
              position="left">
              <CardListItem
                card={card}
                isActive={activeTier === card.id}
                onSelect={handleCardSelection}
              />
            </NonAdminAction>
          ))
        )}
      </div>
      <div className="tw-mt-6 tw-text-right" data-testid="buttons">
        <Button
          size="regular"
          theme="primary"
          variant="text"
          onClick={handleCancel}>
          Discard
        </Button>
        {loading ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <Loader size="small" type="white" />
          </Button>
        ) : status === 'success' ? (
          <Button
            disabled
            className="tw-w-16 tw-h-10 disabled:tw-opacity-100"
            size="regular"
            theme="primary"
            variant="contained">
            <i aria-hidden="true" className="fa fa-check" />
          </Button>
        ) : (
          <Button
            className="tw-w-16 tw-h-10"
            size="regular"
            theme="primary"
            variant="contained"
            onClick={handleSave}>
            Save
          </Button>
        )}
      </div>
    </div>
  );
};

export default observer(ManageTab);
