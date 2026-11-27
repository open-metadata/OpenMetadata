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

export const Table: FC<Props> = ({
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
      d="M2 10.555c0-3.772 0-5.657 1.172-6.829S6.229 2.555 10 2.555s5.657 0 6.828 1.171S18 6.783 18 10.555c0 3.77 0 5.657-1.172 6.828S13.771 18.555 10 18.555s-5.657 0-6.828-1.172S2 14.326 2 10.555M2 7.5h16m-10.668 0v10"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Table.displayName = 'Table';
