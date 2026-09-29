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

export const Memories: FC<Props> = ({
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
      d="M15.522 9.57a4.214 4.214 0 1 1 1.234-2.98l1.204-1.116"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M12.469 5.184v1.56l1.467.361m.07 5.455v.361c0 1.096 0 1.645-.219 2.063-.192.369-.5.668-.877.856-.43.213-.992.213-2.116.213h-4.36c-.418 0-.627 0-.827.04a2 2 0 0 0-.51.174c-.18.09-.344.218-.67.473L2.83 17.985c-.279.217-.418.326-.535.326a.34.34 0 0 1-.262-.123c-.073-.09-.073-.263-.073-.61v-8.18c0-1.097 0-1.645.219-2.064.192-.368.5-.667.877-.855.43-.213 2.046-.213 3.17-.213"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Memories.displayName = 'Memories';
