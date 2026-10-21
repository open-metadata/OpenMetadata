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

export const AppMetadataExplorerColored: FC<Props> = ({
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
      fill="url(#app-metadata-explorer-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M15.075 13.13c2.672 0 4.839-.813 4.839-1.815S17.747 9.5 15.075 9.5s-4.839.812-4.839 1.815 2.167 1.814 4.84 1.814m-3.026 1.719c.365.109.772.2 1.21.266m1.815 2.244c-2.672 0-4.839-.813-4.839-1.815m1.814 3.535c.365.11.772.2 1.21.266"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M15.077 21.595c-2.672 0-4.839-.812-4.839-1.815v-8.468m9.678 0v4.234m.706 4.677.134-1.138c.07-.605.106-.908-.06-1.074s-.469-.13-1.075-.06l-1.137.134m2.175-.037-3.384 3.384"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-metadata-explorer-colored_a"
        x1={9.369}
        x2={22.631}
        y1={46.561}
        y2={17.439}>
        <stop stopColor="#7873F5" />
        <stop offset={1} stopColor="#EC77AB" />
      </linearGradient>
    </defs>
  </svg>
);
AppMetadataExplorerColored.displayName = 'AppMetadataExplorerColored';
