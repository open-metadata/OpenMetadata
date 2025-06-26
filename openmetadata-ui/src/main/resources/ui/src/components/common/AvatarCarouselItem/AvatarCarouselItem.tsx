/*
 *  Copyright 2024 Collate.
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
import { Badge, Button } from 'antd';
import classNames from 'classnames';
import React, { RefObject, useCallback, useRef } from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

interface AvatarCarouselItemProps {
  avatar: EntityReference;
  index: number;
  onAvatarClick: (index: number) => void;
  avatarBtnRefs: React.MutableRefObject<RefObject<HTMLButtonElement>[]>;
  isActive: boolean;
}

const AvatarCarouselItem = ({
  avatar,
  index,
  avatarBtnRefs,
  onAvatarClick,
  isActive,
}: AvatarCarouselItemProps) => {
  const { suggestionsByUser, fetchSuggestionsByUserId } =
    useSuggestionsContext();
  const buttonRef = useRef(null);
  avatarBtnRefs.current[index] = buttonRef;
  const getUserSuggestionsCount = useCallback(
    (userName: string) =>
      suggestionsByUser.get(userName)?.combinedData.length ?? 0,
    [suggestionsByUser]
  );

  const handleAvatarClick = useCallback(() => {
    // Call the original onAvatarClick function
    onAvatarClick(index);

    // Fetch suggestions for this specific user
    if (avatar.id) {
      fetchSuggestionsByUserId(avatar.id);
    }
  }, [onAvatarClick, index, avatar.id, fetchSuggestionsByUserId]);

  const button = (
    <Button
      className={classNames('p-0 m-r-xss avatar-item', {
        active: isActive,
      })}
      data-testid={`avatar-carousel-item-${avatar.id}`}
      ref={buttonRef}
      shape="circle"
      onClick={handleAvatarClick}>
      <ProfilePicture name={avatar.name ?? ''} width="28" />
    </Button>
  );

  return (
    <UserPopOverCard key={avatar.id} userName={avatar?.name ?? ''}>
      <Badge count={getUserSuggestionsCount(avatar?.name ?? '')}>
        {button}
      </Badge>
    </UserPopOverCard>
  );
};

export default AvatarCarouselItem;
