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
    xmlnsXlink="http://www.w3.org/1999/xlink"
    {...props}>
    <mask
      height={32}
      id="app-collate-ai-chat-colored_a"
      maskUnits="userSpaceOnUse"
      width={32}
      x={0}
      y={0}>
      <rect fill="#fff" height={32} rx={6} width={32} />
    </mask>
    <g mask="url(#app-collate-ai-chat-colored_a)">
      <use
        fill="url(#app-collate-ai-chat-colored_c)"
        xlinkHref="#app-collate-ai-chat-colored_b"
      />
      <use
        fill="url(#app-collate-ai-chat-colored_d)"
        xlinkHref="#app-collate-ai-chat-colored_b"
      />
      <use
        fill="url(#app-collate-ai-chat-colored_e)"
        xlinkHref="#app-collate-ai-chat-colored_b"
      />
      <use
        fill="url(#app-collate-ai-chat-colored_f)"
        xlinkHref="#app-collate-ai-chat-colored_b"
      />
      <path
        clipRule="evenodd"
        d="M9.662 13.842 16 10.352l1.068.587-5.056 2.805L16 15.94l5.055-2.804 1.282.706L16 17.332zm0 5.566 1.838-.994 1.067.588-.556.309L16 21.507l5.055-2.805 1.282.706L16 22.898z"
        fill="#fff"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="m9.662 16.627 1.838-.994 1.067.588-.556.308L16 18.725l5.055-2.804 1.282.706L16 20.117z"
        fill="#fff"
        fillRule="evenodd"
      />
      <path
        d="m21.29 10.956-.566-.163a1.55 1.55 0 0 1-1.07-1.07l-.161-.566c-.025-.09-.175-.09-.2 0l-.16.566c-.15.52-.55.92-1.07 1.07l-.567.163a.1.1 0 0 0-.076.101c0 .048.03.087.076.101l.566.164a1.55 1.55 0 0 1 1.07 1.07l.16.565a.105.105 0 0 0 .1.076.1.1 0 0 0 .098-.076l.16-.566c.15-.52.55-.92 1.07-1.07l.567-.163a.1.1 0 0 0 .076-.1.11.11 0 0 0-.076-.102zm.335-1.375-.207-.06a.57.57 0 0 1-.392-.39l-.059-.208c-.009-.033-.063-.033-.073 0l-.058.207a.57.57 0 0 1-.392.391l-.207.06a.04.04 0 0 0-.028.037q.001.028.028.037l.207.06c.19.055.337.2.392.391l.058.207c.005.017.02.028.036.028a.04.04 0 0 0 .036-.028l.06-.207c.054-.19.2-.336.39-.391l.208-.06a.039.039 0 0 0 0-.074"
        fill="#fff"
      />
    </g>
    <defs>
      <radialGradient
        cx={0}
        cy={0}
        gradientTransform="matrix(29.5388 -8.50419 8.36283 29.0464 .507 -3.249)"
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-chat-colored_d"
        r={1}>
        <stop stopColor="#AFF" stopOpacity={0.9} />
        <stop offset={1} stopColor="#AFF" stopOpacity={0} />
      </radialGradient>
      <radialGradient
        cx={0}
        cy={0}
        gradientTransform="matrix(29.5388 -8.50419 8.36283 29.0464 .507 -3.249)"
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-chat-colored_f"
        r={1}>
        <stop stopColor="#AFF" stopOpacity={0.9} />
        <stop offset={1} stopColor="#AFF" stopOpacity={0} />
      </radialGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-chat-colored_c"
        x1={-17.75}
        x2={44.177}
        y1={-9.875}
        y2={35.998}>
        <stop stopColor="#0EF" />
        <stop offset={0.3} stopColor="#0AF" />
        <stop offset={0.6} stopColor="#42F" />
        <stop offset={1} stopColor="#C4F" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-chat-colored_e"
        x1={-17.75}
        x2={44.177}
        y1={-9.875}
        y2={35.998}>
        <stop stopColor="#0EF" />
        <stop offset={0.3} stopColor="#0AF" />
        <stop offset={0.6} stopColor="#42F" />
        <stop offset={1} stopColor="#C4F" />
      </linearGradient>
      <path
        d="M22.876 44.833c18.127-5.219 28.661-23.899 23.53-41.723-5.133-17.824-23.987-28.043-42.114-22.825-18.126 5.219-28.66 23.899-23.529 41.723 5.132 17.825 23.987 28.043 42.113 22.825"
        id="app-collate-ai-chat-colored_b"
      />
    </defs>
  </svg>
);
AppCollateAiChatColored.displayName = 'AppCollateAiChatColored';
