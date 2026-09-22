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

export const Flag04: FC<Props> = ({
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
    <path d="M13.5 6.5h6.206c.428 0 .643 0 .772.09a.5.5 0 0 1 .208.337c.023.156-.073.347-.265.73l-1.252 2.505a1 1 0 0 0-.106.252.5.5 0 0 0-.004.175c.01.066.038.13.094.256l1.347 3.03c.167.375.25.562.223.714a.5.5 0 0 1-.211.325c-.128.086-.333.086-.743.086H12.1c-.56 0-.84 0-1.054-.109a1 1 0 0 1-.437-.437c-.109-.214-.109-.494-.109-1.054V11M3 21V3.5M3 11h8.9c.56 0 .84 0 1.054-.109a1 1 0 0 0 .437-.437c.109-.214.109-.494.109-1.054V4.1c0-.56 0-.84-.109-1.054a1 1 0 0 0-.437-.437C12.74 2.5 12.46 2.5 11.9 2.5H4.6c-.56 0-.84 0-1.054.109a1 1 0 0 0-.437.437C3 3.26 3 3.54 3 4.1z" />
  </svg>
);
Flag04.displayName = 'Flag04';
