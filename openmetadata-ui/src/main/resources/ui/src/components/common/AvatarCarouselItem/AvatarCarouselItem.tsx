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
import React, { RefObject, useRef } from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import UserPopOverCard from '../PopOverCard/UserPopOverCard';
import ProfilePicture from '../ProfilePicture/ProfilePicture';

interface AvatarCarouselItemProps {
  avatar: EntityReference;
  index: number;
  currentSlide: number;
  onAvatarClick: (index: number) => void;
  avatarBtnRefs: React.MutableRefObject<RefObject<HTMLButtonElement>[]>;
}

const AvatarCarouselItem = ({
  avatar,
  index,
  currentSlide,
  avatarBtnRefs,
  onAvatarClick,
}: AvatarCarouselItemProps) => {
  const { selectedUserSuggestions } = useSuggestionsContext();

  const isActive = currentSlide === index;
  const buttonRef = useRef(null);
  avatarBtnRefs.current[index] = buttonRef;

  const button = (
    <Button
      className={classNames('p-0 m-r-xss avatar-item', {
        active: isActive,
      })}
      ref={buttonRef}
      shape="circle"
      onClick={() => onAvatarClick(index)}>
      <ProfilePicture name={avatar.name ?? ''} width="28" />
    </Button>
  );

  return (
    <UserPopOverCard key={avatar.id} userName={avatar?.name ?? ''}>
      {isActive ? ( // Show Badge only for active item
        <Badge count={selectedUserSuggestions.length}>{button}</Badge>
      ) : (
        button
      )}
    </UserPopOverCard>
  );
};

export default AvatarCarouselItem;
