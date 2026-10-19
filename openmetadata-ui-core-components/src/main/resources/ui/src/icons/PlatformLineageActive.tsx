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

export const PlatformLineageActive: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke={color}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <g stroke="currentColor" strokeWidth={1.3} transform="translate(1.35 2)">
      <path d="M10.833 8H7.197m3.636 5.598a1.38 1.38 0 0 1-1.382-1.381V3.78c0-.763.618-1.382 1.381-1.382" />
      <rect height={6.4} rx={3.2} width={6.4} x={0.65} y={4.801} />
      <path
        d="M16 2a1.35 1.35 0 1 1-2.7 0A1.35 1.35 0 0 1 16 2Zm0 5.602a1.35 1.35 0 1 1-2.7 0 1.35 1.35 0 0 1 2.7 0ZM16 14a1.35 1.35 0 1 1-2.7 0 1.35 1.35 0 0 1 2.7 0Z"
        fill="currentColor"
      />
    </g>
  </svg>
);
PlatformLineageActive.displayName = 'PlatformLineageActive';
