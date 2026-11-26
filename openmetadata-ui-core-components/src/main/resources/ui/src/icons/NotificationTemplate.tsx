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

export const NotificationTemplate: FC<Props> = ({
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
      d="M5.122 5.813C3.194 5.823 2 6.972 2 8.723v5.817c0 1.76 1.203 2.913 3.148 2.913l5.372-.002"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m11.7 3.223-3.244.003c-1.857.013-3.007 1.417-3.007 3.558v7.108c0 2.152 1.159 3.562 3.032 3.562l5.173-.003c1.857-.013 3.007-1.417 3.007-3.559V9.3m-5.021 5.04H8.468m4.279-2.586H8.469m4.857-2.59H8.47"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={15.938}
      cy={4.61}
      r={2.063}
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
NotificationTemplate.displayName = 'NotificationTemplate';
