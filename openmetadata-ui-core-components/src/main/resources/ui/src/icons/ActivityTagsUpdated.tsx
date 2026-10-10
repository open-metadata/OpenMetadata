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

export const ActivityTagsUpdated: FC<Props> = ({
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
      <path d="M10.887 5.89C11 5.618 11 5.315 11 4.71V2.975c0-.931 0-1.397-.29-1.686C10.423 1 9.957 1 9.026 1H7.29c-.605 0-.908 0-1.18.113-.272.112-.486.326-.914.755L2.481 4.583C1.494 5.57 1 6.063 1 6.677s.494 1.107 1.481 2.094l.748.748C4.216 10.506 4.709 11 5.323 11" />
      <path d="M8.625 3.25h.125m-.25 0a.25.25 0 1 0 .5 0 .25.25 0 0 0-.5 0m-1.154 7.13-.971.195.194-.971a1 1 0 0 1 .279-.52l2.274-2.275a.51.51 0 0 1 .72 0l.299.299a.51.51 0 0 1 0 .72l-2.274 2.274c-.142.143-.323.24-.52.279Z" />
    </g>
  </svg>
);
ActivityTagsUpdated.displayName = 'ActivityTagsUpdated';
