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

import { ImageList } from '../generated/entity/teams/user';

export enum ImageQuality {
  '1x',
  '1.5x',
  '2x',
  '3x',
  '4x',
  '5x',
  '6x',
}

/**
 * Returns correct imageSrc from given images or undefined if not any
 *
 * @param imageList list of images from we get the required one
 * @param quality ImageQuality that you need in return
 *
 * @returns `string` | `undefined`
 *
 * Refer ImageQuality enum for applicable qualities
 * It's having fallback mechanism, so if you ask for 2x
 * It will try to find `2x` first if not found
 * Then it will try for `1.5x` if not found
 * Then it will try for `1x` or return `undefined` if not found
 *
 */
// Ordered from lowest to highest quality; index matches the numeric `ImageQuality` enum value.
const IMAGE_FIELDS_BY_QUALITY: (keyof ImageList)[] = [
  'image',
  'image24',
  'image32',
  'image48',
  'image72',
  'image192',
  'image512',
];

export const getImageWithResolutionAndFallback = (
  quality: ImageQuality,
  imageList?: ImageList
): string | undefined => {
  if (!imageList) {
    return undefined;
  }

  for (let index = quality; index >= 0; index--) {
    const field = IMAGE_FIELDS_BY_QUALITY[index];
    if (imageList[field]) {
      return imageList[field];
    }
  }

  return undefined;
};
