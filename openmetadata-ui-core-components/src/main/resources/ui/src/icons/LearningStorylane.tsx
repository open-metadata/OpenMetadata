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
import * as React from 'react';
import type { SVGProps, FC } from 'react';
interface Props extends SVGProps<SVGSVGElement> {
  color?: string;
  size?: number;
}

export const LearningStorylane: FC<Props> = ({
  size = 24,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M2 4a4 4 0 0 1 4-4h6l6 6v10a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
      fill="#155EEF"
    />
    <path d="m12 0 6 6h-2a4 4 0 0 1-4-4z" fill="#fff" opacity={0.3} />
    <g
      clipPath="url(#learning-storylane_a)"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M10 15.333a3.333 3.333 0 1 0 0-6.666 3.333 3.333 0 0 0 0 6.666" />
      <path d="M9.167 10.989c0-.16 0-.24.033-.284a.17.17 0 0 1 .122-.066c.055-.004.122.04.256.125l1.573 1.012c.117.074.175.112.195.16a.17.17 0 0 1 0 .129c-.02.047-.079.085-.195.16l-1.573 1.01c-.134.087-.2.13-.256.126a.17.17 0 0 1-.122-.066c-.033-.045-.033-.124-.033-.283z" />
    </g>
    <defs>
      <clipPath id="learning-storylane_a">
        <path d="M6 8h8v8H6z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
LearningStorylane.displayName = 'LearningStorylane';
