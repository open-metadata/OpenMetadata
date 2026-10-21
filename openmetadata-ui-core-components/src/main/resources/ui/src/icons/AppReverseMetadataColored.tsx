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

export const AppReverseMetadataColored: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 32 32"
    width={size}
    {...props}>
    <rect
      fill="url(#app-reverse-metadata-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M14.7 12.1a2.6 2.6 0 1 0-5.2 0 2.6 2.6 0 0 0 5.2 0m0 7.801a2.6 2.6 0 1 0-5.2 0 2.6 2.6 0 0 0 5.2 0m7.8-7.801a2.6 2.6 0 1 0-5.201 0 2.6 2.6 0 0 0 5.2 0m.001 7.801a2.6 2.6 0 1 0-5.201 0 2.6 2.6 0 0 0 5.2 0"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-reverse-metadata-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#FFF5C3" />
        <stop offset={1} stopColor="#9452A5" />
      </linearGradient>
    </defs>
  </svg>
);
AppReverseMetadataColored.displayName = 'AppReverseMetadataColored';
