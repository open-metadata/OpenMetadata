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

import { isEmpty } from 'lodash';
import { TableDetail } from 'Models';
import React, { FunctionComponent, useEffect, useState } from 'react';
import appState from '../../AppState';
import cardData from '../../jsons/tiersData.json';
import SVGIcons from '../../utils/SvgUtils';
import { Button } from '../buttons/Button/Button';
import CardListItem from '../card-list/CardListItem/CardWithListItems';
import DropDownList from '../dropdown/DropDownList';

type Props = {
  currentTier?: string;
  currentUser?: string;
  onSave: (owner: TableDetail['owner'], tier: TableDetail['tier']) => void;
};

const ManageTab: FunctionComponent<Props> = ({
  currentTier = '',
  currentUser = '',
  onSave,
}: Props) => {
  const { data } = cardData;
  const [activeTier, setActiveTier] = useState(currentTier);
  const [listVisible, setListVisible] = useState(false);
  const [listOwners] = useState(() => {
    const user = !isEmpty(appState.userDetails)
      ? appState.userDetails
      : appState.users.length
      ? appState.users[0]
      : undefined;
    const teams = (appState.userDetails.teams || appState.userTeams).map(
      (team) => ({
        name: team.name,
        value: team.id,
        group: 'Teams',
      })
    );

    return user
      ? [{ name: user.displayName, value: user.id }, ...teams]
      : teams;
  });
  const [owner, setOwner] = useState(currentUser);

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
    // Save API call goes here...
    const newOwner: TableDetail['owner'] =
      owner !== currentUser
        ? {
            id: owner,
            type: owner === listOwners[0].value ? 'user' : 'team',
          }
        : undefined;
    const newTier = activeTier !== currentTier ? activeTier : undefined;
    onSave(newOwner, newTier);
  };

  const handleCancel = () => {
    setActiveTier(currentTier);
    setOwner(currentUser);
  };

  useEffect(() => {
    setActiveTier(currentTier);
  }, [currentTier]);

  useEffect(() => {
    setOwner(currentUser);
  }, [currentUser]);

  return (
    <div className="tw-max-w-3xl tw-mx-auto">
      <div className="tw-mt-2 tw-mb-4 tw-pb-4 tw-border-b tw-border-gray-300">
        <span className="tw-mr-2">Owner:</span>
        <span className="tw-relative">
          <Button
            className="tw-underline"
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
              title="edit"
            />
          </Button>
          {listVisible && (
            <DropDownList
              dropDownList={listOwners}
              listGroups={['Teams']}
              value={owner}
              onSelect={handleOwnerSelection}
            />
          )}
        </span>
      </div>
      <div className="tw-flex tw-flex-col">
        {data.map((card, i) => (
          <CardListItem
            card={card}
            isActive={activeTier === card.id}
            key={i}
            onSelect={handleCardSelection}
          />
        ))}
      </div>
      <div className="tw-mt-6 tw-text-right">
        <Button
          size="regular"
          theme="primary"
          variant="text"
          onClick={handleCancel}>
          Discard
        </Button>
        <Button
          size="regular"
          theme="primary"
          variant="contained"
          onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};

export default ManageTab;
