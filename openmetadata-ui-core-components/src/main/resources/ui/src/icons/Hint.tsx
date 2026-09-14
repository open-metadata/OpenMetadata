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

export const Hint: FC<Props> = ({
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
    <circle
      cx={9.998}
      cy={9.908}
      r={4.998}
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M8.27 14.906v1.364a1.73 1.73 0 0 0 3.46 0v-1.364M2.923 9.91H2.09m2.9-5.014-.624-.621m10.646.621.625-.621m2.274 5.637h-.833M10 2v.833"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Hint.displayName = 'Hint';
