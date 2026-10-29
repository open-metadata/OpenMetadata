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

export const ActivityDescriptionUpdated: FC<Props> = ({
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
      d="M15.6 9.666v-3.2c0-2.263 0-3.394-.703-4.097s-1.834-.703-4.097-.703H7.6c-2.262 0-3.393 0-4.096.703S2.8 4.203 2.8 6.466v6.4c0 2.262 0 3.394.703 4.096.703.703 1.834.703 4.096.703h1.6M6 8.466h3.2M6 5.266h6.4m.59 12.122-1.388.278.277-1.39a1.47 1.47 0 0 1 .399-.744l3.252-3.252a.73.73 0 0 1 1.03 0l.428.427a.73.73 0 0 1 0 1.03l-3.252 3.253a1.46 1.46 0 0 1-.745.398"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityDescriptionUpdated.displayName = 'ActivityDescriptionUpdated';
