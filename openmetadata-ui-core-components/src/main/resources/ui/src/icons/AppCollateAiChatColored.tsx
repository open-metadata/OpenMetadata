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

export const AppCollateAiChatColored: FC<Props> = ({
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
      fill="url(#app-collate-ai-chat-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M20.322 18.284H22.5c-1.637 3.958-6.863 4.713-9.753 1.965l-3.06.911c-.129.043-.243-.1-.157-.213l1.879-2.634c-1.78-4.03 1.538-8.471 6.008-8.187 2.136.143 4.442 1.652 5.083 3.702h-2.022c-1.41-2.192-4.499-2.705-6.392-.826-3.674 3.66 1.509 10.251 6.122 5.553.1-.1.1-.27.114-.27"
      fill="#fff"
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-chat-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={0}>
        <stop stopColor="#1570EF" />
        <stop offset={1} stopColor="#2E90FA" />
      </linearGradient>
    </defs>
  </svg>
);
AppCollateAiChatColored.displayName = 'AppCollateAiChatColored';
