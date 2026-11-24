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

export const AutoClassification: FC<Props> = ({
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
      d="M17.75 6.5a4.75 4.75 0 1 1-9.5 0 4.75 4.75 0 0 1 9.5 0Zm-4.8-1.75v3.5m-1.7 5.5v4.5m-4.5-15.5h-4.5m14 15.5h-5m-9-8v-7.5m14 11v4.5m-9.5-8h-4.5m12.5-3.8h-3.5m-9 7.3h5.5v4.5h-5.5z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AutoClassification.displayName = 'AutoClassification';
