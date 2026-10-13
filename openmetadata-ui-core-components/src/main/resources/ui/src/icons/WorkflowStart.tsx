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

export const WorkflowStart: FC<Props> = ({
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
      d="M6.47 13.748C3.649 6.437 7.648 3.203 10 2.5c2.351.703 6.35 3.937 3.527 11.248-.426-.234-1.728-.703-3.528-.703s-3.102.469-3.528.703"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M11.5 7.754a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0m2.625 4.914c1.081.1 2.405.393 3.36 1.081 0 0 .393-3.701-2.985-4.499m-8.626 3.418c-1.081.1-2.405.393-3.36 1.081 0 0-.392-3.701 2.985-4.499m2.626 6S8.437 17.125 10 17.5c1.562-.375 1.874-2.25 1.874-2.25"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowStart.displayName = 'WorkflowStart';
