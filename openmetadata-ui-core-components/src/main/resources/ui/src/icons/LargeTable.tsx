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

export const LargeTable: FC<Props> = ({
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
      d="M2 10.027c0-3.3 0-4.95 1.172-5.975S6.229 3.027 10 3.027s5.657 0 6.828 1.025C18 5.078 18 6.728 18 10.027c0 3.3 0 4.95-1.172 5.975S13.771 17.027 10 17.027s-5.657 0-6.828-1.025S2 13.327 2 10.027M2 7.5h16M6.566 10.629H4.028m7.242 0H8.73m7.305 0h-2.538m-6.931 3H4.028m7.242 0H8.73m7.305 0h-2.538"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LargeTable.displayName = 'LargeTable';
