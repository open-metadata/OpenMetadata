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

export const Lightbulb03: FC<Props> = ({
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
      d="M7.917 18.333h4.167m.417-5.562a5.833 5.833 0 1 0-5 0v.562c0 .777 0 1.165.127 1.471a1.67 1.67 0 0 0 .903.903c.304.126.692.126 1.469.126s1.165 0 1.471-.127a1.67 1.67 0 0 0 .903-.902c.126-.306.126-.694.126-1.471z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Lightbulb03.displayName = 'Lightbulb03';
