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

export const BehaviorPersonality: FC<Props> = ({
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
      d="M17.113 18c0-1.24 0-1.86-.153-2.366a3.56 3.56 0 0 0-2.37-2.37c-.505-.153-1.126-.153-2.366-.153H7.78c-1.241 0-1.861 0-2.366.153a3.56 3.56 0 0 0-2.37 2.37C2.89 16.14 2.89 16.76 2.89 18M14 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
BehaviorPersonality.displayName = 'BehaviorPersonality';
