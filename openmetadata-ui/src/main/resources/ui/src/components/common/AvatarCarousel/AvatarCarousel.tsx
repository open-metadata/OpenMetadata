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
import { ButtonUtility } from '@openmetadata/ui-core-components';
import {
  ChevronLeft,
  ChevronRight,
} from '@openmetadata/ui-core-components/icons';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import AvatarCarouselItem from '../AvatarCarouselItem/AvatarCarouselItem';
import './avatar-carousel.less';

interface AvatarCarouselProps {
  showArrows?: boolean;
}

const AvatarCarousel = ({ showArrows = false }: AvatarCarouselProps) => {
  const {
    allSuggestionsUsers: avatarList,
    onUpdateActiveUser,
    selectedUserSuggestions,
  } = useSuggestionsContext();
  const [currentSlide, setCurrentSlide] = useState(-1);
  const avatarBtnRefs = useRef<RefObject<HTMLButtonElement>[]>([]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === 0 ? avatarList.length - 1 : prev - 1));
  }, [avatarList]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev === avatarList.length - 1 ? 0 : prev + 1));
  }, [avatarList]);

  const handleMouseOut = useCallback(() => {
    avatarBtnRefs.current.forEach((ref: RefObject<HTMLButtonElement>) => {
      ref.current?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    });
  }, [avatarBtnRefs]);

  const onProfileClick = useCallback(
    (index: number) => {
      const activeUser = avatarList[index];
      onUpdateActiveUser(activeUser);
      handleMouseOut();
    },
    [avatarList]
  );

  useEffect(() => {
    onProfileClick(currentSlide);
  }, [currentSlide]);

  useEffect(() => {
    if (selectedUserSuggestions.combinedData.length === 0) {
      setCurrentSlide(-1);
    }
  }, [selectedUserSuggestions.combinedData]);

  return (
    <div className="avatar-carousel-container d-flex items-center">
      {showArrows && (
        <ButtonUtility
          className="carousel-arrow"
          color="tertiary"
          data-testid="prev-slide"
          icon={ChevronLeft}
          isDisabled={avatarList.length <= 1 || currentSlide <= 0}
          size="xs"
          onClick={prevSlide}
        />
      )}

      <div className="tw:flex tw:items-center">
        {avatarList.map((avatar, index) => (
          <AvatarCarouselItem
            avatar={avatar}
            avatarBtnRefs={avatarBtnRefs}
            index={index}
            isActive={currentSlide === index}
            key={avatar.id}
            onAvatarClick={setCurrentSlide}
          />
        ))}
      </div>

      {showArrows && (
        <ButtonUtility
          className="carousel-arrow"
          color="tertiary"
          data-testid="next-slide"
          icon={ChevronRight}
          isDisabled={
            avatarList.length <= 1 || currentSlide === avatarList.length - 1
          }
          size="xs"
          onClick={nextSlide}
        />
      )}
    </div>
  );
};

export default AvatarCarousel;
