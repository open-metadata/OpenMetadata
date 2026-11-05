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

export const AlertTriangle: FC<Props> = ({
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
    <path
      d="M10 7.5v3.333m0 3.333h.008M8.846 3.243 1.992 15.082c-.38.657-.57.985-.542 1.255a.83.83 0 0 0 .338.588c.219.159.598.159 1.358.159h13.708c.758 0 1.138 0 1.357-.159a.83.83 0 0 0 .339-.587c.028-.27-.162-.598-.542-1.255l-6.855-11.84c-.378-.654-.568-.982-.815-1.092a.83.83 0 0 0-.677 0c-.247.11-.436.438-.815 1.092"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AlertTriangle.displayName = 'AlertTriangle';
