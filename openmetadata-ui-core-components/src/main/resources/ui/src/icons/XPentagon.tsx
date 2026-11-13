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

export const XPentagon: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M3.477 11.363V4a2 2 0 0 1 2-2h9.048a2 2 0 0 1 2 2v7.12a2 2 0 0 1-.589 1.418l-4.204 4.19a2 2 0 0 1-2.676.133l-4.843-3.947a2 2 0 0 1-.736-1.55m8.509-5.118-1.985 1.985m0 0-1.993 1.993M10 8.231l1.994 1.993M10 8.231 8.016 6.246"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
XPentagon.displayName = 'XPentagon';
