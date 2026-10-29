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

export const CubeOutline: FC<Props> = ({
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
      d="m8.125 17.292 1.228.682c.237.132.354.198.48.223a.8.8 0 0 0 .335 0c.125-.026.243-.092.48-.223l1.228-.682m-7.5-2.083-1.189-.661c-.25-.138-.375-.208-.465-.307a.8.8 0 0 1-.179-.303c-.043-.127-.043-.27-.043-.555v-1.3m0-4.167V6.618c0-.286 0-.428.042-.556a.8.8 0 0 1 .179-.303c.091-.099.215-.168.465-.307l1.189-.66m3.75-2.083 1.228-.682c.237-.132.354-.197.48-.223a.8.8 0 0 1 .335 0c.125.025.243.092.48.223l1.228.682m3.75 2.083 1.189.661c.25.138.375.208.465.307a.8.8 0 0 1 .179.303c.042.128.042.27.042.556v1.298m0 4.167v1.299c0 .285 0 .428-.042.555a.8.8 0 0 1-.179.303c-.091.099-.215.168-.465.307l-1.189.661m-7.5-6.25L10 10m0 0 1.875-1.042M10 10v2.083m-7.5-6.25 1.875 1.042m11.25 0L17.5 5.833M10 16.25v2.083"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
CubeOutline.displayName = 'CubeOutline';
