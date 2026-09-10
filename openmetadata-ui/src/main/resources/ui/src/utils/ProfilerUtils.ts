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
const computeImageFallbacks = (imageList?: ImageList) => {
  const { image, image24, image32, image48, image72, image192, image512 } =
    imageList || {};

  const fallbackFrom24 = image24 || image;
  const fallbackFrom32 = image32 || fallbackFrom24;
  const fallbackFrom48 = image48 || fallbackFrom32;
  const fallbackFrom72 = image72 || fallbackFrom48;
  const fallbackFrom192 = image192 || fallbackFrom72;
  const fallbackFrom512 = image512 || fallbackFrom192;

  return {
    image,
    fallbackFrom24,
    fallbackFrom32,
    fallbackFrom48,
    fallbackFrom72,
    fallbackFrom192,
    fallbackFrom512,
  };
};

export const getImageWithResolutionAndFallback = (
  quality: ImageQuality,
  imageList?: ImageList
): string | undefined => {
  const {
    image,
    fallbackFrom24,
    fallbackFrom32,
    fallbackFrom48,
    fallbackFrom72,
    fallbackFrom192,
    fallbackFrom512,
  } = computeImageFallbacks(imageList);

  // Each quality resolves to its own fallback chain (e.g. 4x falls back
  // through 72->48->32->24->base), computed above; anything not in the map
  // (including 1x) returns the base image.
  const qualityToImage: Partial<Record<ImageQuality, string | undefined>> = {
    [ImageQuality['1.5x']]: fallbackFrom24,
    [ImageQuality['2x']]: fallbackFrom32,
    [ImageQuality['3x']]: fallbackFrom48,
    [ImageQuality['4x']]: fallbackFrom72,
    [ImageQuality['5x']]: fallbackFrom192,
    [ImageQuality['6x']]: fallbackFrom512,
  };

  return qualityToImage[quality] ?? image;
};
