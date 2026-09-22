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

export const Hexagon01: FC<Props> = ({
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
    <path d="M11.223 2.432c.284-.158.425-.237.575-.267a1 1 0 0 1 .403 0c.15.03.292.11.576.267l7.4 4.11c.3.167.45.25.558.369a1 1 0 0 1 .215.364c.05.153.05.324.05.667v8.117c0 .342 0 .514-.05.666a1 1 0 0 1-.215.364c-.109.119-.258.202-.558.368l-7.4 4.111c-.284.158-.425.237-.575.268a1 1 0 0 1-.403 0c-.15-.031-.292-.11-.576-.268l-7.4-4.11c-.3-.167-.45-.25-.558-.369a1 1 0 0 1-.215-.364C3 16.573 3 16.401 3 16.06V7.942c0-.343 0-.514.05-.667a1 1 0 0 1 .215-.364c.109-.119.258-.202.558-.368z" />
  </svg>
);
Hexagon01.displayName = 'Hexagon01';
