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

export const LlmService: FC<Props> = ({
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
      d="M14.785 6.382h-.002m0 0-4.74 1.27m4.74-1.27a1.636 1.636 0 1 0 3.161-.847 1.636 1.636 0 0 0-3.161.846zm-9.787-.921.022.017m0 0 2.037 1.563M5.018 5.478a1.636 1.636 0 1 0-2.763-1.753 1.636 1.636 0 0 0 2.763 1.753m1.448 8.497.008-.028m0 0 1.287-4.271m-1.287 4.271a1.636 1.636 0 1 0-1.513 2.902 1.636 1.636 0 0 0 1.513-2.902m2.41-4.291a1.636 1.636 0 1 1-.847-3.161 1.636 1.636 0 0 1 .847 3.16m4.942 2.644a1.385 1.385 0 1 1-2.77 0 1.385 1.385 0 0 1 2.77 0m-2.479-1.101L9.748 9.352"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LlmService.displayName = 'LlmService';
