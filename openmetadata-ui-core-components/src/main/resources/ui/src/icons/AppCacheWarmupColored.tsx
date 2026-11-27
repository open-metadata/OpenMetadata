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

export const AppCacheWarmupColored: FC<Props> = ({
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
      fill="url(#app-cache-warmup-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="m13.819 10.245-1.109.512c-1.706.79-2.56 1.184-2.56 1.831 0 .648.854 1.042 2.56 1.831l1.109.513c1.074.496 1.61.745 2.182.745.57 0 1.108-.249 2.182-.745l1.108-.513c1.707-.789 2.56-1.183 2.56-1.83 0-.648-.853-1.043-2.56-1.832l-1.108-.512c-1.074-.497-1.611-.745-2.182-.745s-1.108.248-2.182.745"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M21.713 15.414c.092.13.138.264.138.412 0 .638-.853 1.027-2.56 1.805l-1.108.505c-1.074.49-1.611.734-2.182.734s-1.108-.244-2.182-.734l-1.109-.505c-1.706-.778-2.56-1.167-2.56-1.805q0-.22.138-.412"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M21.446 18.773c.27.216.405.43.405.684 0 .639-.853 1.027-2.56 1.805l-1.108.505c-1.074.49-1.611.735-2.182.735s-1.108-.245-2.182-.735l-1.109-.505c-1.706-.778-2.56-1.166-2.56-1.805 0-.254.136-.468.406-.684"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-cache-warmup-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#FFD3A5" />
        <stop offset={1} stopColor="#FD6585" />
      </linearGradient>
    </defs>
  </svg>
);
AppCacheWarmupColored.displayName = 'AppCacheWarmupColored';
