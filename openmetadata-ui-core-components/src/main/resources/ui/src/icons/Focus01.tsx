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

export const Focus01: FC<Props> = ({
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
      d="M6.444 2h-1.6c-.995 0-1.493 0-1.873.194-.335.17-.607.442-.777.777C2 3.35 2 3.849 2 4.844v1.6M6.444 18h-1.6c-.995 0-1.493 0-1.873-.194a1.78 1.78 0 0 1-.777-.777C2 16.65 2 16.151 2 15.156v-1.6m16-7.112v-1.6c0-.995 0-1.493-.194-1.873a1.78 1.78 0 0 0-.777-.777C16.65 2 16.151 2 15.156 2h-1.6M18 13.556v1.6c0 .995 0 1.493-.194 1.873-.17.335-.442.607-.777.777-.38.194-.878.194-1.873.194h-1.6m0-8a3.556 3.556 0 1 1-7.112 0 3.556 3.556 0 0 1 7.112 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Focus01.displayName = 'Focus01';
