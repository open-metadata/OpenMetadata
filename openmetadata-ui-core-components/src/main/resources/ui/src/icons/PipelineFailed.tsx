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

export const PipelineFailed: FC<Props> = ({
  size = 20,
  color = 'currentColor',
  ...props
}) => (
  <svg
    aria-hidden="true"
    color={color}
    fill="none"
    height={size}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 20 20"
    width={size}
    {...props}>
    <path
      d="M6.366 2.32 2.291 6.43A1 1 0 0 0 2 7.14l.024 5.787c0 .266.107.52.296.708l4.109 4.075a1 1 0 0 0 .71.291l5.787-.024c.266 0 .52-.107.708-.296l4.075-4.109a1 1 0 0 0 .291-.71l-.024-5.787a1 1 0 0 0-.296-.708l-4.11-4.076A1 1 0 0 0 12.86 2l-5.787.024a1 1 0 0 0-.708.296Zm6 5.309L10 9.995m0 0-2.373 2.372M10 9.995l2.373 2.372M10 9.995 7.634 7.629"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
PipelineFailed.displayName = 'PipelineFailed';
