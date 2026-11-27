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

export const SampleData: FC<Props> = ({
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
      d="M12.351 2.75h-8.28c-.644 0-.965 0-1.219.105a1.38 1.38 0 0 0-.747.747C2 3.856 2 4.177 2 4.82s0 .965.105 1.219c.14.338.409.606.747.747.254.105.575.105 1.218.105h8.281c.643 0 .965 0 1.219-.105a1.38 1.38 0 0 0 .747-.747c.105-.254.105-.576.105-1.219s0-.964-.105-1.218a1.38 1.38 0 0 0-.747-.747c-.254-.105-.575-.105-1.219-.105Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M4.07 11.031c-.643 0-.964 0-1.218-.105a1.38 1.38 0 0 1-.747-.747C2 9.926 2 9.604 2 8.961s0-.965.105-1.218a1.38 1.38 0 0 1 .747-.747c.254-.105.575-.105 1.218-.105h8.281c.643 0 .965 0 1.219.105.338.14.607.408.747.747m-6.624 3.288H4.07c-.643 0-.964 0-1.218.105a1.38 1.38 0 0 0-.747.747C2 12.137 2 12.458 2 13.102c0 .643 0 .964.105 1.218.14.338.409.607.747.747.254.105.575.105 1.218.105h4.4M4.07 4.82h.007M4.07 8.96h.007m-.007 4.142h.007M6.14 4.82h.008M6.14 8.96h.008m-.008 4.142h.008"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={13.854}
      cy={13.104}
      r={4.147}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.851 11.656v1.447m0 0v1.45m0-1.45h1.45m-1.45 0h-1.447"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SampleData.displayName = 'SampleData';
