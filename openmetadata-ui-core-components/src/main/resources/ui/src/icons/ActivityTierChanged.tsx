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

export const ActivityTierChanged: FC<Props> = ({
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
      d="m7.315 2.916-1.364.63c-2.1.972-3.15 1.457-3.15 2.254s1.05 1.282 3.15 2.253l1.364.63c1.322.611 1.983.917 2.686.917s1.364-.306 2.685-.917l1.364-.63c2.1-.97 3.15-1.456 3.15-2.253s-1.05-1.282-3.15-2.253l-1.364-.63C11.365 2.304 10.704 2 10.001 2s-1.364.305-2.686.916"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M17.031 9.28q.17.235.17.506c0 .786-1.05 1.264-3.15 2.221l-1.365.622c-1.321.602-1.982.903-2.685.903s-1.364-.301-2.686-.903l-1.364-.622c-2.1-.957-3.15-1.435-3.15-2.22 0-.183.056-.349.17-.508"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.702 13.412c.332.265.499.529.499.841 0 .786-1.05 1.264-3.15 2.221l-1.365.622c-1.321.602-1.982.903-2.685.903s-1.364-.301-2.686-.903l-1.364-.622c-2.1-.957-3.15-1.435-3.15-2.22 0-.313.166-.577.498-.842"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityTierChanged.displayName = 'ActivityTierChanged';
