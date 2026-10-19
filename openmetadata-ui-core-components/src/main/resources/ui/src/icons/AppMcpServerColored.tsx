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

export const AppMcpServerColored: FC<Props> = ({
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
    <rect fill="url(#app-mcp-server-colored_a)" height={32} rx={6} width={32} />
    <path
      d="m10.027 15.824 5.743-5.742a1.988 1.988 0 0 1 2.81 2.811M17.407 22.5l-.909-.908a.703.703 0 0 1 0-.994l4.894-4.894a1.988 1.988 0 1 0-2.81-2.811l-4.337 4.337"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="m19.865 14.416-4.337 4.337a1.988 1.988 0 0 1-2.811-2.81l4.337-4.337"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-mcp-server-colored_a"
        x1={0}
        x2={0}
        y1={0}
        y2={32}>
        <stop stopColor="#7579FF" />
        <stop offset={1} stopColor="#B224EF" />
      </linearGradient>
    </defs>
  </svg>
);
AppMcpServerColored.displayName = 'AppMcpServerColored';
