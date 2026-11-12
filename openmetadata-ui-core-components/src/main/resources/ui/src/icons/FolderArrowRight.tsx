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

export const FolderArrowRight: FC<Props> = ({
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
      d="M15.6 17.202c.485-.472 2.4-1.727 2.4-2.4s-1.915-1.928-2.4-2.4m1.6 2.4h-5.6M10 17.2c-3.771 0-5.657 0-6.828-1.17C2 14.857 2 12.971 2 9.2V6.757c0-1.453 0-2.18.304-2.725a2.4 2.4 0 0 1 .926-.926c.546-.304 1.272-.304 2.725-.304.931 0 1.397 0 1.804.153.93.348 1.314 1.194 1.734 2.033L10 6.001m0 0H6.8M10 6h3.8c1.685 0 2.528 0 3.133.404.262.175.487.4.663.662.388.581.403 1.38.404 2.934v.8"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
FolderArrowRight.displayName = 'FolderArrowRight';
