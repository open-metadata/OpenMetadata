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

export const DynamicAgent: FC<Props> = ({
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
      d="m13.579 2 .638 1.659c.152.397.229.595.347.762q.16.224.383.383c.167.118.365.195.762.347l1.659.638-1.659.639c-.397.152-.595.229-.762.347a1.6 1.6 0 0 0-.383.383c-.118.167-.195.365-.347.762l-.639 1.659-.637-1.659c-.153-.397-.23-.595-.348-.762a1.6 1.6 0 0 0-.383-.383c-.167-.118-.365-.195-.762-.347l-1.659-.639 1.659-.638c.397-.152.595-.229.762-.347q.224-.16.383-.383c.118-.167.195-.365.348-.762zm-4.747 9.826H3.917a1.287 1.287 0 1 1 0-2.573h4.915m0 0a1.801 1.801 0 1 0 2.521 2.573 1.801 1.801 0 0 0-2.52-2.573m-3.14 8.234h4.916a1.287 1.287 0 0 0 0-2.573H5.693M2.63 16.2a1.801 1.801 0 1 0 3.602 0 1.801 1.801 0 0 0-3.602 0"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
DynamicAgent.displayName = 'DynamicAgent';
