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

export const AppTelemetryColored: FC<Props> = ({
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
    <rect fill="url(#app-telemetry-colored_a)" height={32} rx={6} width={32} />
    <path
      d="m21.377 23.677-3.84-6.911-3.84 6.911M19.01 9.852l-6.829 4.036a1.636 1.636 0 0 0-.577 2.205l.789 1.399a1.557 1.557 0 0 0 2.154.59l6.83-4.036m-2.137-3.84a1.257 1.257 0 0 1 2.177-1.257l2.095 3.63a1.258 1.258 0 0 1-2.177 1.256zm-10.92 7.53.567 1.05m0 0 .567 1.05m-.567-1.05 2.89-1.638"
      stroke="#fff"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.2}
    />
    <defs>
      <linearGradient
        gradientUnits="userSpaceOnUse"
        id="app-telemetry-colored_a"
        x1={0}
        x2={32}
        y1={0}
        y2={32}>
        <stop stopColor="#72EDF2" />
        <stop offset={1} stopColor="#5151E5" />
      </linearGradient>
    </defs>
  </svg>
);
AppTelemetryColored.displayName = 'AppTelemetryColored';
