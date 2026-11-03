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

export const MicrosoftTeams: FC<Props> = ({
  size = 20,
  color: _color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    viewBox="0 0 33 32"
    width={size}
    {...props}>
    <g clipPath="url(#microsoft-teams_a)">
      <path
        d="M27.394 12.221c.265.265.578.476.923.623.72.301 1.532.301 2.253 0a2.92 2.92 0 0 0 1.545-1.546 2.92 2.92 0 0 0 0-2.253A2.92 2.92 0 0 0 30.57 7.5a2.92 2.92 0 0 0-2.253 0 2.92 2.92 0 0 0-1.546 1.545 2.92 2.92 0 0 0 0 2.253c.147.344.36.658.623.923m-.848 2.688v8.727H28q.752-.004 1.488-.141a4.6 4.6 0 0 0 1.41-.492 3.14 3.14 0 0 0 1.05-.927c.29-.425.435-.933.415-1.448V14.91zm-4.713-3.658c.386.002.769-.075 1.125-.227a2.92 2.92 0 0 0 1.544-1.546 2.9 2.9 0 0 0-.002-2.253 2.92 2.92 0 0 0-1.545-1.545 2.8 2.8 0 0 0-1.127-.227 2.8 2.8 0 0 0-1.118.227c-.264.112-.347.26-.71.436v4.471c.365.178.446.324.71.437.355.153.737.23 1.123.227M20 25.944c.364.079.494.14.752.175q.426.06.854.063a6.4 6.4 0 0 0 1.312-.142c.439-.088.86-.252 1.243-.485a2.84 2.84 0 0 0 .927-.92 2.65 2.65 0 0 0 .366-1.446V13.091H20zM0 28.727 18.91 32V0L0 3.273z"
        fill="#5558AF"
      />
      <path
        d="m13.817 9.818-8.727.532v2.013l3.273-.132v9.333l2.18.128v-9.547L13.818 12z"
        fill="#fff"
      />
    </g>
    <defs>
      <clipPath id="microsoft-teams_a">
        <path d="M0 0h32.366v32H0z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
MicrosoftTeams.displayName = 'MicrosoftTeams';
