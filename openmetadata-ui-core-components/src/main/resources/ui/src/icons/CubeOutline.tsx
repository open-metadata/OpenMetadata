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

export const CubeOutline: FC<Props> = ({
  size = 24,
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
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size}
    {...props}>
    <path d="m9.75 20.75 1.473.818c.284.158.425.237.576.268.133.027.27.027.402 0 .15-.031.292-.11.576-.268l1.473-.818m-9-2.5-1.427-.793c-.3-.166-.45-.25-.558-.368a1 1 0 0 1-.215-.364C3 16.573 3 16.401 3 16.06V14.5m0-5V7.942c0-.343 0-.514.05-.667a1 1 0 0 1 .215-.364c.109-.119.258-.202.558-.368L5.25 5.75m4.5-2.5 1.473-.818c.284-.158.425-.237.576-.267a1 1 0 0 1 .402 0c.15.03.292.11.576.267l1.473.818m4.5 2.5 1.427.793c.3.166.45.25.558.368a1 1 0 0 1 .215.364c.05.153.05.324.05.667V9.5m0 5v1.559c0 .342 0 .514-.05.666a1 1 0 0 1-.215.364c-.109.119-.258.202-.558.368l-1.427.793m-9-7.5L12 12m0 0 2.25-1.25M12 12v2.5M3 7l2.25 1.25m13.5 0L21 7m-9 12.5V22" />
  </svg>
);
CubeOutline.displayName = 'CubeOutline';
