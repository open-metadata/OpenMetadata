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

export const Brush01: FC<Props> = ({
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
      d="M10.622 10.088H2.8a.8.8 0 0 1-.8-.8V2.8a.8.8 0 0 1 .8-.8h9.333a.8.8 0 0 1 .8.8v4.826"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.844 7.012 9.359 4.551 4.844 10m5.511 6.506c0-1.07.428-2.094 1.187-2.845l4.419-4.37c.224-.221.526-.346.841-.346h.019a1.178 1.178 0 0 1 .828 2.017l-4.404 4.356a4.1 4.1 0 0 1-2.89 1.188Zm0 0L8.844 18M13.2 9.914l3.91 3.868"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M4.666 5.25a.707.707 0 0 0 .711-.703.707.707 0 0 0-.71-.703.707.707 0 0 0-.712.703c0 .388.318.703.711.703"
      fill="currentColor"
    />
  </svg>
);
Brush01.displayName = 'Brush01';
