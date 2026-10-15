/*
 *  Copyright 2023 Collate.
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

import { Box, Button, Dot } from '@openmetadata/ui-core-components';
import { ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface AppScreenshotsProps {
  screenshots: ReactElement[];
}

export const AppScreenshots = ({ screenshots }: AppScreenshotsProps) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const currentIndex = Math.min(
    activeIndex,
    Math.max(0, screenshots.length - 1)
  );

  useEffect(() => {
    // Stop automatic changes while users read, focus a control, or request reduced motion.
    const isUserInteracting = isHovered || isFocused;
    if (
      isPaused ||
      isUserInteracting ||
      screenshots.length < 2 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % screenshots.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isPaused, isHovered, isFocused, screenshots.length]);

  return (
    <Box
      aria-label={t('label.image')}
      className="p-x-md"
      data-testid="app-screenshots"
      direction="col"
      gap={3}
      role="region"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsFocused(false);
        }
      }}
      onFocus={() => setIsFocused(true)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}>
      <div className="tw:overflow-hidden">
        <Box
          className="tw:transition-transform tw:duration-500 tw:ease-in-out tw:motion-reduce:transition-none"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
          {screenshots.map((screenshot, index) => (
            <div
              aria-hidden={currentIndex !== index}
              className="app-slider-container tw:w-full tw:shrink-0"
              data-testid="slider-container"
              key={screenshot.key}>
              {screenshot}
            </div>
          ))}
        </Box>
      </div>
      {screenshots.length > 1 && (
        <Box align="center" gap={2} justify="center">
          {screenshots.map((screenshot, index) => (
            <Button
              aria-label={`${t('label.page')} ${index + 1}`}
              aria-pressed={currentIndex === index}
              color={currentIndex === index ? 'primary' : 'secondary'}
              key={screenshot.key}
              size="sm"
              onPress={() => setActiveIndex(index)}>
              <Dot aria-hidden size="xs" />
            </Button>
          ))}
          <Button
            color="tertiary"
            size="sm"
            onPress={() => setIsPaused((paused) => !paused)}>
            {t(isPaused ? 'label.play' : 'label.pause')}
          </Button>
        </Box>
      )}
    </Box>
  );
};
