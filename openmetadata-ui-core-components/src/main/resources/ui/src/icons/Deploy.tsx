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

export const Deploy: FC<Props> = ({
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
      d="m9.834 5.36 1.25-1.251c1.41-1.409 3.253-1.993 5.205-2.089.76-.037 1.139-.056 1.443.249.305.304.286.684.249 1.443-.096 1.952-.68 3.796-2.089 5.204l-1.25 1.251c-1.03 1.03-1.324 1.324-1.107 2.441.213.854.42 1.68-.201 2.301-.753.753-1.44.753-2.193 0l-6.049-6.05c-.753-.752-.753-1.439 0-2.192.62-.62 1.447-.414 2.301-.2 1.118.216 1.41-.077 2.44-1.107M2 18l4.21-4.21M7.05 18l1.685-1.684M2 12.946l1.684-1.684"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M14.316 5.789h-.106m.211 0a.21.21 0 1 1-.421 0 .21.21 0 0 1 .421 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Deploy.displayName = 'Deploy';
