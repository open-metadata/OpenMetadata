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

export const WorkflowGitSync: FC<Props> = ({
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
      d="M5.121 7.004v3.374m0 0v1.125c0 2.12 0 3.181.658 3.84.619.619 1.591.656 3.463.659m-4.12-5.624h4.12m0-.003c0-.707 0-1.06.22-1.28s.572-.22 1.279-.22c.706 0 1.06 0 1.279.22.22.22.22.573.22 1.28s0 1.06-.22 1.28-.573.22-1.28.22c-.706 0-1.059 0-1.278-.22s-.22-.573-.22-1.28m0 5.625c0-.707 0-1.06.22-1.28s.572-.22 1.279-.22c.706 0 1.06 0 1.279.22.22.22.22.573.22 1.28s0 1.06-.22 1.28-.573.22-1.28.22c-.706 0-1.059 0-1.278-.22s-.22-.573-.22-1.28M3.999 2.504h2.247c1.36 0 1.499.832 1.499 2.25 0 1.417-.139 2.249-1.499 2.249H4c-1.36 0-1.499-.832-1.499-2.25 0-1.417.138-2.25 1.499-2.25m13.502 6.823-1.13-1.338c-.156-.187-.26-.23-.37-.234-.11-.003-.238.035-.417.234l-1.09 1.33m1.508-1.564-.017 6.192c.053.656-.037 1.925-1.498 2.06"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WorkflowGitSync.displayName = 'WorkflowGitSync';
