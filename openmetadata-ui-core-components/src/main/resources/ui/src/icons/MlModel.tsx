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

export const MlModel: FC<Props> = ({
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
      d="M4.146 6.293a2.146 2.146 0 1 0 0-4.293 2.146 2.146 0 0 0 0 4.293m0 11.707a2.146 2.146 0 1 0 0-4.293 2.146 2.146 0 0 0 0 4.293m11.707-5.852a2.146 2.146 0 1 0 0-4.292 2.146 2.146 0 0 0 0 4.292M6.098 5.121l7.805 3.903m-7.805 5.853 7.805-3.902"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MlModel.displayName = 'MlModel';
