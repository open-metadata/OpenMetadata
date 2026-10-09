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

export const ActivityColumnTagsUpdated: FC<Props> = ({
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
    viewBox="0 0 12 12"
    width={size}
    {...props}>
    <g stroke="currentColor">
      <path d="M10.454 5.405c.112-.272.112-.574.112-1.18V2.49c0-.93 0-1.396-.289-1.685s-.754-.29-1.685-.29H6.857c-.606 0-.908 0-1.18.113-.273.113-.487.327-.915.755L2.047 4.098C1.06 5.086.567 5.58.567 6.193S1.06 7.3 2.047 8.287l.748.748c.987.987 1.481 1.48 2.094 1.48" />
      <path d="M8.191 2.766h.125m-.25 0a.25.25 0 1 0 .5 0 .25.25 0 0 0-.5 0m1.74 6.174H8.89m0 0h-.917m.917 0v.917m0-.917v-.917" />
      <circle cx={8.889} cy={8.939} r={2.545} />
    </g>
  </svg>
);
ActivityColumnTagsUpdated.displayName = 'ActivityColumnTagsUpdated';
