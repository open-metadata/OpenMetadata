/*
 *  Copyright 2025 Collate.
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
import tinycolor, { ColorFormats } from 'tinycolor2';

const clamp = (val: number, min: number, max: number) =>
  Math.max(min, Math.min(max, val));

const deltas = [
  {
    h: -4.954128440366901,
    s: 0.128,
    l: 0.47058823529411775,
  },
  {
    h: -8.704128440366986,
    s: 0.128,
    l: 0.45882352941176474,
  },
  {
    h: -6.2584762664539255,
    s: 0.128,
    l: 0.4,
  },
  {
    h: -8.460621946860499,
    s: 0.128,
    l: 0.3392156862745098,
  },
  {
    h: -9.10046990378163,
    s: 0.128,
    l: 0.24901960784313726,
  },
  {
    h: -8.130599028602262,
    s: 0.1050114942528736,
    l: 0.14901960784313728,
  },
  {
    h: -3.777657852131682,
    s: 0.08127102803738318,
    l: 0.07058823529411762,
  },
  {
    h: 0,
    s: 0,
    l: 0,
  },
  {
    h: 3.024594963888319,
    s: -0.06858119658119666,
    l: -0.05098039215686273,
  },
  {
    h: 4.770009490667491,
    s: -0.12070466321243523,
    l: -0.13137254901960782,
  },
  {
    h: 2.823649337410785,
    s: -0.18845569620253155,
    l: -0.19999999999999996,
  },
];
const applyDelta = (base: ColorFormats.HSL, delta: ColorFormats.HSL) => ({
  h: base.h + delta.h,
  s: clamp(base.s + delta.s, 0, 1),
  l: clamp(base.l + delta.l, 0, 1),
});

export const generatePalette = (newPrimaryHex: string) => {
  const baseHSL = tinycolor(newPrimaryHex).toHsl();

  return deltas.map((delta) => {
    const newColor = applyDelta(baseHSL, delta);

    return tinycolor(newColor).toHexString();
  });
};
