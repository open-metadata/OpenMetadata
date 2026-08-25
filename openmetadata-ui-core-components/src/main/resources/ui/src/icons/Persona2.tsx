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

export const Persona2: FC<Props> = ({
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
      d="M16.64 18c0-1.24 0-1.86-.153-2.366a3.56 3.56 0 0 0-2.37-2.37c-.505-.153-1.125-.153-2.366-.153H7.307c-1.24 0-1.86 0-2.366.153a3.56 3.56 0 0 0-2.37 2.37c-.153.505-.153 1.125-.153 2.366M13.529 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Persona2.displayName = 'Persona2';
