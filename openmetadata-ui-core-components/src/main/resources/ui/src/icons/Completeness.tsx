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

export const Completeness: FC<Props> = ({
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
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="m7.602 9.998 1.6 1.6 3.2-3.2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m11.915 2.8-.196-.167a2.65 2.65 0 0 0-3.437 0l-.197.168a3.2 3.2 0 0 1-1.821.754l-.258.02a2.65 2.65 0 0 0-2.43 2.43l-.021.259a3.2 3.2 0 0 1-.754 1.82l-.168.198a2.65 2.65 0 0 0 0 3.437l.168.196a3.2 3.2 0 0 1 .754 1.821l.02.258a2.65 2.65 0 0 0 2.43 2.43l.259.021a3.2 3.2 0 0 1 1.82.754l.197.168a2.65 2.65 0 0 0 3.438 0l.196-.168a3.2 3.2 0 0 1 1.821-.754l.258-.02a2.65 2.65 0 0 0 2.43-2.43l.021-.259a3.2 3.2 0 0 1 .754-1.82l.168-.197a2.65 2.65 0 0 0 0-3.437l-.168-.197a3.2 3.2 0 0 1-.754-1.821l-.02-.258a2.65 2.65 0 0 0-2.43-2.43l-.259-.021a3.2 3.2 0 0 1-1.82-.754"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Completeness.displayName = 'Completeness';
