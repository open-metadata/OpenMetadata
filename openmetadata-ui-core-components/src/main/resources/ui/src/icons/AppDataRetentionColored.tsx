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

export const AppDataRetentionColored: FC<Props> = ({
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
      fill="url(#app-data-retention-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M18.275 9.5v2.6m-5.2-2.6v2.6m8.385 1.298c-.082-.846-.27-1.415-.695-1.84-.762-.761-1.988-.761-4.44-.761h-1.3c-2.452 0-3.677 0-4.44.762-.76.761-.76 1.987-.76 4.44v1.3c0 2.451 0 3.678.76 4.44.526.525 1.273.688 2.49.738M9.824 14.7h3.251"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M18.274 22.501a3.9 3.9 0 1 0 0-7.802 3.9 3.9 0 0 0 0 7.802"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M18.275 16.648v1.654c0 .108 0 .162.017.21q.021.063.07.111c.034.036.082.06.179.109l1.035.517"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-data-retention-colored_a"
        x1={10.346}
        x2={2.369}
        y1={9.849}
        y2={45.519}>
        <stop stopColor="#39A0FF" />
        <stop offset={1} stopColor="#8FFF85" />
      </linearGradient>
    </defs>
  </svg>
);
AppDataRetentionColored.displayName = 'AppDataRetentionColored';
