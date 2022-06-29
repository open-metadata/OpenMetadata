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

import { ColumnProfile } from '../generated/entity/data/table';
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

export const getRoundedValue = (
  value: ColumnProfile['histogram'] | Date | undefined
) => {
  if (typeof value == 'number' && !isNaN(value)) {
    if (Number.isInteger(value)) {
      return value;
    } else {
      return value.toFixed(2);
    }
  } else {
    return value;
  }
};

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
export const getImageWithResolutionAndFallback = (
  quality: ImageQuality,
  imageList?: ImageList,
): string | undefined => {
  const { image, image24, image32, image48, image72, image192, image512 } =
    imageList || {};

  switch (quality) {
    case ImageQuality['1.5x']:
      return image24 || image;
    case ImageQuality['2x']:
      return image32 || image24 || image;
    case ImageQuality['3x']:
      return image48 || image32 || image24 || image;
    case ImageQuality['4x']:
      return image72 || image48 || image32 || image24 || image;
    case ImageQuality['5x']:
      return image192 || image72 || image48 || image32 || image24 || image;
    case ImageQuality['6x']:
      return (
        image512 ||
        image192 ||
        image72 ||
        image48 ||
        image32 ||
        image24 ||
        image
      );
    case ImageQuality['1x']:
    default:
      return image;
  }
};
