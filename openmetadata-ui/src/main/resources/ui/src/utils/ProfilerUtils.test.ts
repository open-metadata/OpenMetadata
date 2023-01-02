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

import {
  getImageWithResolutionAndFallback,
  getRoundedValue,
  ImageQuality,
} from './ProfilerUtils';

const mockImageList = {
  image: 'image',
  image192: 'image192',
  image24: 'image24',
  image32: 'image32',
  image48: 'image48',
  image512: 'image512',
  image72: 'image72',
};

const mockImageListWithLowQuality = {
  image: 'image',
};

describe('Test ProfilerUtils', () => {
  it('getImageWithResolutionAndFallback should return Image with specified quality if present', () => {
    expect(
      getImageWithResolutionAndFallback(ImageQuality['6x'], mockImageList)
    ).toEqual(mockImageList.image512);
  });

  it('getImageWithResolutionAndFallback should return lower quality if asked quality is not present', () => {
    expect(
      getImageWithResolutionAndFallback(
        ImageQuality['5x'],
        mockImageListWithLowQuality
      )
    ).toEqual(mockImageList.image);
    expect(
      getImageWithResolutionAndFallback(
        ImageQuality['5x'],
        mockImageListWithLowQuality
      )
    ).not.toEqual(mockImageList.image512);
  });

  it('getRoundedValue should return integer value as it is', () => {
    expect(getRoundedValue(12)).toBe(12);
  });

  it('getRoundedValue should other values as it is', () => {
    expect(getRoundedValue(false)).toBe(false);
  });
});
