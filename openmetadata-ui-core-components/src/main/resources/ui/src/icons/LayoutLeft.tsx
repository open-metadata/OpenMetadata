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

export const LayoutLeft: FC<Props> = ({
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
      d="M16.222 2H3.778C2.796 2 2 2.796 2 3.778v12.444C2 17.204 2.796 18 3.778 18h12.444c.982 0 1.778-.796 1.778-1.778V3.778C18 2.796 17.204 2 16.222 2M3.777 5.023h4.445M3.777 7.688h4.445m-4.445 2.668h4.445m-4.445 2.667h4.445m-4.445 2.665h4.445M8.223 2v16"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
LayoutLeft.displayName = 'LayoutLeft';
