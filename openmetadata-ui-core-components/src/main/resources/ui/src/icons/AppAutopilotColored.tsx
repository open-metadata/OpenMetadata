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

export const AppAutopilotColored: FC<Props> = ({
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
    <rect fill="url(#app-autopilot-colored_a)" height={32} rx={6} width={32} />
    <path
      d="m18.459 16.589 2.178.852c1.257.492 1.885.738 1.864 1.128s-.676.569-1.988.926c-.39.107-.585.16-.72.296-.136.135-.19.33-.296.72-.357 1.312-.536 1.968-.926 1.989-.39.02-.636-.608-1.128-1.864l-.853-2.18c-.514-1.315-.772-1.973-.438-2.306.333-.334.99-.076 2.307.439"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <path
      d="M21.85 15.35V13.4c0-1.838 0-2.758-.571-3.329s-1.49-.571-3.33-.571H13.4c-1.838 0-2.758 0-3.329.571s-.571 1.49-.571 3.33v3.25c0 1.838 0 2.757.571 3.328.571.572 1.49.572 3.329.572h1.3m-5.2-8.453h12.35"
      stroke="#FAFAFA"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-autopilot-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#CE9FFC" />
        <stop offset={1} stopColor="#7367F0" />
      </linearGradient>
    </defs>
  </svg>
);
AppAutopilotColored.displayName = 'AppAutopilotColored';
