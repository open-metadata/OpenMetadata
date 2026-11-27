/*
 *  Copyright 2026 Collate.
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

import { useEffect, useState } from 'react';
import { isHardToSeeOnDark, isValidUrl } from './ThemeSettings.utils';

export type ImageStatus = 'idle' | 'invalid' | 'loading' | 'loaded' | 'error';

export interface ImageCheck {
  status: ImageStatus;
  isHardToSeeOnDark: boolean;
}

const IDLE: ImageCheck = { status: 'idle', isHardToSeeOnDark: false };
const DEBOUNCE_MS = 400;
const SAMPLE_SIZE = 32;

const loadImage = (url: string, crossOrigin?: 'anonymous') =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    if (crossOrigin) {
      image.crossOrigin = crossOrigin;
    }
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });

// ponytail: needs CORS headers on the image host to read pixels; without them
// the canvas is tainted and the warning is skipped rather than guessed.
const checkDarkContrast = async (url: string) => {
  try {
    const image = await loadImage(url, 'anonymous');
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_SIZE;
    canvas.height = SAMPLE_SIZE;
    const context = canvas.getContext('2d');
    if (!context) {
      return false;
    }
    context.drawImage(image, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

    return isHardToSeeOnDark(
      context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data
    );
  } catch {
    return false;
  }
};

/** Whether a logo URL loads as an image, and whether it vanishes on a dark surface. */
export const useImageCheck = (url?: string): ImageCheck => {
  const [check, setCheck] = useState<ImageCheck>(IDLE);

  useEffect(() => {
    if (!url) {
      setCheck(IDLE);

      return undefined;
    }
    if (!isValidUrl(url)) {
      setCheck({ status: 'invalid', isHardToSeeOnDark: false });

      return undefined;
    }
    let isActive = true;
    setCheck({ status: 'loading', isHardToSeeOnDark: false });

    const timer = setTimeout(async () => {
      try {
        await loadImage(url);
      } catch {
        if (isActive) {
          setCheck({ status: 'error', isHardToSeeOnDark: false });
        }

        return;
      }
      if (!isActive) {
        return;
      }
      // The image loads, so Save need not wait; the contrast warning is optional
      // and its CORS request may be slow or never finish.
      setCheck({ status: 'loaded', isHardToSeeOnDark: false });
      const isHard = await checkDarkContrast(url);
      if (isActive && isHard) {
        setCheck({ status: 'loaded', isHardToSeeOnDark: true });
      }
    }, DEBOUNCE_MS);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [url]);

  return check;
};
