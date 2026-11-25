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

export const AppMicrosoftTeamsColored: FC<Props> = ({
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
      fill="url(#app-microsoft-teams-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <g clipPath="url(#app-microsoft-teams-colored_b)">
      <path
        d="M17.219 15.148c0-.203.164-.367.367-.367h4.547c.203 0 .367.164.367.367v2.68a2.64 2.64 0 1 1-5.281 0z"
        fill="url(#app-microsoft-teams-colored_c)"
      />
      <path
        d="M13.156 14.467c0-.275.223-.498.498-.498h5.504c.275 0 .498.223.498.498v3.97a3.25 3.25 0 1 1-6.5 0z"
        fill="url(#app-microsoft-teams-colored_d)"
      />
      <path
        d="M20.469 13.969a1.219 1.219 0 1 0 0-2.438 1.219 1.219 0 0 0 0 2.438"
        fill="#34439E"
      />
      <path
        d="M20.469 13.969a1.219 1.219 0 1 0 0-2.438 1.219 1.219 0 0 0 0 2.438"
        fill="url(#app-microsoft-teams-colored_e)"
      />
      <path
        d="M16.813 13.563a1.625 1.625 0 1 0 0-3.25 1.625 1.625 0 0 0 0 3.25"
        fill="url(#app-microsoft-teams-colored_f)"
      />
      <mask
        height={13}
        id="app-microsoft-teams-colored_i"
        maskUnits="userSpaceOnUse"
        width={7}
        x={13}
        y={9}>
        <path
          d="M16.406 13.563a2.031 2.031 0 1 0 0-4.063 2.031 2.031 0 0 0 0 4.063"
          fill="url(#app-microsoft-teams-colored_g)"
        />
        <path
          d="M13.654 13.969a.5.5 0 0 0-.498.498v3.97a3.25 3.25 0 0 0 6.5 0v-3.97a.5.5 0 0 0-.498-.498z"
          fill="url(#app-microsoft-teams-colored_h)"
        />
      </mask>
      <g mask="url(#app-microsoft-teams-colored_i)">
        <path
          d="M12.344 14.375c0-.673.545-1.219 1.219-1.219h2.843a1.22 1.22 0 0 1 1.219 1.219v4.875a1.22 1.22 0 0 1-1.219 1.219h-4.062z"
          fill="#000"
          fillOpacity={0.3}
        />
      </g>
      <path
        d="M16 12.344h-5.687a.81.81 0 0 0-.813.812v5.688c0 .448.364.812.813.812H16a.81.81 0 0 0 .813-.812v-5.688a.81.81 0 0 0-.813-.812"
        fill="url(#app-microsoft-teams-colored_j)"
      />
      <path
        d="M14.781 13.969h-3.25v.745h1.217v3.317h.817v-3.317h1.216z"
        fill="#fff"
      />
    </g>
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_a"
        x1={-21.035}
        x2={32.109}
        y1={60.335}
        y2={7.193}>
        <stop stopColor="#BDBDBD" />
        <stop offset={1} stopColor="#F8F8F8" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_c"
        x1={17.219}
        x2={22.565}
        y1={15.081}
        y2={18.574}>
        <stop stopColor="#364088" />
        <stop offset={1} stopColor="#6E7EE1" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_d"
        x1={13.156}
        x2={19.656}
        y1={17.383}
        y2={17.383}>
        <stop stopColor="#515FC4" />
        <stop offset={1} stopColor="#7084EA" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_e"
        x1={19.25}
        x2={21.605}
        y1={11.659}
        y2={13.317}>
        <stop stopColor="#364088" />
        <stop offset={1} stopColor="#6E7EE1" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_f"
        x1={15.652}
        x2={17.741}
        y1={10.777}
        y2={13.214}>
        <stop stopColor="#4858AE" />
        <stop offset={1} stopColor="#4E60CE" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_g"
        x1={14.955}
        x2={17.567}
        y1={10.08}
        y2={13.127}>
        <stop stopColor="#4858AE" />
        <stop offset={1} stopColor="#4E60CE" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_h"
        x1={14.955}
        x2={17.567}
        y1={10.08}
        y2={13.127}>
        <stop stopColor="#4858AE" />
        <stop offset={1} stopColor="#4E60CE" />
      </linearGradient>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-microsoft-teams-colored_j"
        x1={9.5}
        x2={16.813}
        y1={16}
        y2={16}>
        <stop stopColor="#2A3887" />
        <stop offset={1} stopColor="#4C56B9" />
      </linearGradient>
      <clipPath id="app-microsoft-teams-colored_b">
        <path d="M9.5 9.5h13v13h-13z" fill="#fff" />
      </clipPath>
    </defs>
  </svg>
);
AppMicrosoftTeamsColored.displayName = 'AppMicrosoftTeamsColored';
