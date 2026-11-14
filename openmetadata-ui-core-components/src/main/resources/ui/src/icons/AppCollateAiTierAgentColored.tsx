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

export const AppCollateAiTierAgentColored: FC<Props> = ({
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
      fill="url(#app-collate-ai-tier-agent-colored_a)"
      height={32}
      rx={6}
      width={32}
    />
    <path
      d="m16.979 12.397-.24-.417a1 1 0 0 0-1.732 0l-4.641 8.038a1 1 0 0 0 .866 1.5h9.281a1 1 0 0 0 .866-1.5l-1.837-3.182m-6.159-1.606h2.49m-4.346 2.676h8.028m.687-3.603q-.003 0-.003.003l.162.571a.11.11 0 0 0 .103.079c.048 0 .09-.03.103-.079l.162-.574a1.57 1.57 0 0 1 1.08-1.08l.573-.164a.11.11 0 0 0 .078-.102c0-.049-.03-.09-.078-.103l-.573-.163a1.57 1.57 0 0 1-1.08-1.08l-.162-.574c-.025-.09-.175-.09-.2 0l-.162.573a1.57 1.57 0 0 1-1.08 1.081l-.573.163a.11.11 0 0 0-.078.103c0 .048.03.09.078.102l.573.164c.524.15.927.553 1.079 1.077q0 .003-.002.003"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-collate-ai-tier-agent-colored_a"
        x1={0}
        x2={32}
        y1={32}
        y2={0}>
        <stop stopColor="#39A0FF" />
        <stop offset={1} stopColor="#8FFF85" />
      </linearGradient>
    </defs>
  </svg>
);
AppCollateAiTierAgentColored.displayName = 'AppCollateAiTierAgentColored';
