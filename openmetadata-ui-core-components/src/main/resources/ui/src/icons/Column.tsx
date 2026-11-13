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

export const Column: FC<Props> = ({
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
      d="M13.367 2.27h-6v16.144h6z"
      fill="currentColor"
      opacity={0.15}
      stroke="none"
    />
    <path
      d="M2 10.414c0-3.771 0-5.657 1.172-6.828S6.229 2.414 10 2.414s5.657 0 6.828 1.172S18 6.643 18 10.414s0 5.657-1.172 6.829-3.057 1.171-6.828 1.171-5.657 0-6.828-1.172S2 14.186 2 10.415m5-7.29v15.288m6-15.288v15.288M2.367 7.77h15.276"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Column.displayName = 'Column';
