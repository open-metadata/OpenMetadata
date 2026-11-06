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

export const ActivityColumnTagsUpdated: FC<Props> = ({
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
      d="M16.496 9.133c.164-.397.164-.839.164-1.722v-2.53c0-1.358 0-2.037-.422-2.46C15.817 2 15.138 2 13.78 2h-2.531c-.883 0-1.325 0-1.722.164-.397.165-.709.477-1.333 1.101l-3.96 3.961c-1.441 1.44-2.161 2.16-2.161 3.055s.72 1.615 2.16 3.055l1.091 1.09c1.44 1.441 2.16 2.161 3.055 2.161"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M13.195 5.283h.182m-.364 0a.365.365 0 1 0 .73 0 .365.365 0 0 0-.73 0m2.541 9.006h-1.338m0 0H12.88m1.337 0v1.337m0-1.337V12.95"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <circle
      cx={14.212}
      cy={14.288}
      r={3.712}
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ActivityColumnTagsUpdated.displayName = 'ActivityColumnTagsUpdated';
