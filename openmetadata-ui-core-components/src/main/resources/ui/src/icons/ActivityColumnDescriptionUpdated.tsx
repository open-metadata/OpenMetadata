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

export const ActivityColumnDescriptionUpdated: FC<Props> = ({
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
      d="M9.708 18c-3.772 0-5.658 0-6.83-1.172S1.708 13.771 1.708 10s0-5.657 1.172-6.828S5.936 2 9.708 2s5.657 0 6.83 1.172c1.057 1.058 1.16 2.698 1.17 5.785M1.707 7.473h16.002M6.34 12.527h3.524M6.34 17.298V7.473m7.745 9.997-1.39.278.278-1.39c.057-.281.195-.54.399-.744l3.252-3.252a.73.73 0 0 1 1.031 0l.427.427a.73.73 0 0 1 0 1.03l-3.252 3.253a1.46 1.46 0 0 1-.745.398"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityColumnDescriptionUpdated.displayName =
  'ActivityColumnDescriptionUpdated';
