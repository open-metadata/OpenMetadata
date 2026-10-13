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

export const AppCollateAiQualityAgent: FC<Props> = ({
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
      d="M15.903 8.277V5.766c0-1.318 0-1.977-.264-2.48a2.4 2.4 0 0 0-1.059-1.03C14.062 2 13.383 2 12.026 2H6.857C5.5 2 4.822 2 4.303 2.257a2.4 2.4 0 0 0-1.058 1.028c-.265.504-.265 1.163-.265 2.481v8.16c0 1.318 0 1.977.265 2.48a2.4 2.4 0 0 0 1.058 1.03c.519.256 1.197.256 2.554.256h2.989m-.75-8.63H6.21M7.826 12.2H6.211m6.461-6.277h-6.46"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M16.421 10.828h-5.977a.6.6 0 0 0-.598.598v1.6a5.25 5.25 0 0 0 3.586 4.976 5.245 5.245 0 0 0 3.587-4.977v-1.6a.6.6 0 0 0-.598-.597"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m12.285 13.8.852.812 1.988-1.893"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
AppCollateAiQualityAgent.displayName = 'AppCollateAiQualityAgent';
