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
import { Badge, Box, Button } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { RefObject, useCallback, useRef } from 'react';
import { EntityReference } from '../../../generated/entity/type';
import { getSuggestionUserKey } from '../../../utils/Suggestion/SuggestionUtils';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  avatarBtnRefs.current[index] = buttonRef;

  const handleAvatarClick = useCallback(() => {
    // Call the original onAvatarClick function
    onAvatarClick(index);

    // Fetch suggestions for this specific user
    if (avatar.id) {
      fetchSuggestionsByUserId(avatar.id);
    }
  }, [onAvatarClick, index, avatar.id, fetchSuggestionsByUserId]);

  const suggestionsCount =
    suggestionsByUser.get(getSuggestionUserKey(avatar))?.combinedData.length ??
    0;

  return (
    <UserPopOverCard key={avatar.id} userName={avatar?.name ?? ''}>
      <Box inline className="tw:relative m-r-xss">
        <Button
          className={classNames(
            'avatar-item tw:size-7 tw:rounded-full tw:p-0!',
            { active: isActive }
          )}
          color="tertiary"
          data-testid={`avatar-carousel-item-${avatar.id}`}
          ref={buttonRef}
          size="xs"
          onPress={handleAvatarClick}>
          <ProfilePicture name={avatar.name ?? ''} width="28" />
        </Button>
        {suggestionsCount > 0 && (
          <Badge
            className="tw:pointer-events-none tw:absolute tw:-top-3 tw:-right-1.5 tw:max-w-none"
            color="error"
            size="xs"
            variant="solid">
            {suggestionsCount > 99 ? '99+' : suggestionsCount}
          </Badge>
        )}
      </Box>
    </UserPopOverCard>
  );
};

export default AvatarCarouselItem;
