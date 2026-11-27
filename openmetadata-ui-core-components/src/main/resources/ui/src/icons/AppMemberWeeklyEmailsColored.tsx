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

export const AppMemberWeeklyEmailsColored: FC<Props> = ({
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
      fill="url(#app-member-weekly-emails-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="M18.124 9.5v2.6m-5.2-2.6v2.6m8.452 3.901c0-2.451 0-3.677-.761-4.439-.762-.761-1.988-.761-4.439-.761h-1.3c-2.451 0-3.677 0-4.439.761-.761.762-.761 1.988-.761 4.439v1.3c0 2.451 0 3.677.761 4.439.762.761 1.988.761 4.439.761m-5.2-7.798h11.7"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="m16.934 18.3 1.685.956c.62.352.883.352 1.505 0l1.685-.955"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M16.425 20.25c.019.904.028 1.357.362 1.692s.799.346 1.728.37c.573.014 1.14.014 1.713 0 .93-.024 1.394-.035 1.728-.37s.343-.788.363-1.693a20 20 0 0 0 0-.87c-.02-.906-.03-1.358-.363-1.693-.334-.335-.799-.347-1.728-.37a34 34 0 0 0-1.713 0c-.929.023-1.394.035-1.728.37s-.343.787-.362 1.692a20 20 0 0 0 0 .871"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-member-weekly-emails-colored_a"
        x1={39.023}
        x2={19.061}
        y1={50.594}
        y2={10.124}>
        <stop stopColor="#DCB0ED" />
        <stop offset={1} stopColor="#7474BB" />
      </linearGradient>
    </defs>
  </svg>
);
AppMemberWeeklyEmailsColored.displayName = 'AppMemberWeeklyEmailsColored';
