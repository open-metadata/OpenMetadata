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

export const CircleDashed: FC<Props> = ({
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
      d="M18.07 9.056a8.2 8.2 0 0 1 0 1.888m-.608-4.163a8 8 0 0 0-.944-1.633m-1.666-1.666a8 8 0 0 0-1.633-.944m-2.275-.609a8.2 8.2 0 0 0-1.888 0m-2.275.609c-.583.251-1.13.57-1.633.944M3.482 5.148a8 8 0 0 0-.944 1.633m-.609 2.275a8.2 8.2 0 0 0 0 1.888m.609 2.275c.251.583.57 1.13.944 1.633m1.666 1.666c.503.375 1.05.693 1.633.944m2.275.609a8.2 8.2 0 0 0 1.888 0m2.275-.609a8 8 0 0 0 1.633-.944m1.666-1.666c.375-.503.693-1.05.944-1.633"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CircleDashed.displayName = 'CircleDashed';
