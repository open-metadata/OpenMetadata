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

import { getRelativeDateByTimeStamp } from './TimeUtils';

describe('TimeUtils tests', () => {
  it("getRelativeDateByTimeStamp should return Today for currentDay's date", () => {
    expect(getRelativeDateByTimeStamp(Date.now())).toBe('Today');
  });

  it("getRelativeDateByTimeStamp should return Yesterday for yesterday's date", () => {
    expect(
      getRelativeDateByTimeStamp(
        new Date('2020/01/01').valueOf(),
        new Date('2020/01/02').valueOf()
      )
    ).toBe('Yesterday');
  });

  it('getRelativeDateByTimeStamp should return Last month for past months date', () => {
    expect(
      getRelativeDateByTimeStamp(
        new Date('2020/01/01').valueOf(),
        new Date('2020/02/01').valueOf()
      )
    ).toBe('Last month');
  });
});
