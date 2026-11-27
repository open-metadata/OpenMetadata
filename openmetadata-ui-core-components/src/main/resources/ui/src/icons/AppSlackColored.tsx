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

export const AppSlackColored: FC<Props> = ({
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
    <rect fill="url(#app-slack-colored_a)" height={32} rx={6} width={32} />
    <path
      d="M22.3 15.399a1.5 1.5 0 1 0-1.5-1.5v1.5zm-4.2 0a1.5 1.5 0 0 0 1.5-1.5v-4.2a1.5 1.5 0 0 0-3 0v4.2a1.5 1.5 0 0 0 1.5 1.5"
      fill="#2EB67D"
    />
    <path
      d="M9.701 16.598a1.5 1.5 0 1 0 1.5 1.5v-1.5zm4.2 0a1.5 1.5 0 0 0-1.5 1.5v4.2a1.5 1.5 0 0 0 3 0v-4.2a1.5 1.5 0 0 0-1.5-1.5"
      fill="#E01E5A"
    />
    <path
      d="M16.6 22.298a1.5 1.5 0 1 0 1.5-1.5h-1.5zm0-4.2a1.5 1.5 0 0 0 1.5 1.5h4.2a1.5 1.5 0 0 0 0-3h-4.2a1.5 1.5 0 0 0-1.5 1.5"
      fill="#ECB22E"
    />
    <path
      d="M15.4 9.7a1.5 1.5 0 1 0-1.499 1.5h1.5zm0 4.2a1.5 1.5 0 0 0-1.5-1.5H9.702a1.5 1.5 0 0 0 0 3h4.2a1.5 1.5 0 0 0 1.5-1.5"
      fill="#36C5F0"
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-slack-colored_a"
        x1={-21.035}
        x2={32.109}
        y1={60.335}
        y2={7.193}>
        <stop stopColor="#BDBDBD" />
        <stop offset={1} stopColor="#F8F8F8" />
      </linearGradient>
    </defs>
  </svg>
);
AppSlackColored.displayName = 'AppSlackColored';
