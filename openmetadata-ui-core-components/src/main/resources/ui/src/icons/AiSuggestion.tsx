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

export const AiSuggestion: FC<Props> = ({
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
    <mask height={20} id="a" maskUnits="userSpaceOnUse" width={20} x={0} y={0}>
      <path d="M19.993 0H0v19.993h19.993z" fill="#fff" />
    </mask>
    <g mask="url(#a)" stroke="currentColor" strokeWidth={1.3}>
      <path d="M8.344 12.796a1.6 1.6 0 0 0-1.15-1.15l-4.907-1.265a.4.4 0 0 1 0-.77l4.908-1.266a1.6 1.6 0 0 0 1.15-1.149L9.61 2.288a.4.4 0 0 1 .77 0l1.265 4.908a1.6 1.6 0 0 0 1.15 1.15l4.907 1.264a.4.4 0 0 1 0 .772l-4.907 1.264a1.6 1.6 0 0 0-1.15 1.15l-1.266 4.908a.4.4 0 0 1-.77 0zm8.051-9.999v3.2m1.6-1.602h-3.2M3.596 13.996v1.6m.799-.799h-1.6" />
    </g>
  </svg>
);
AiSuggestion.displayName = 'AiSuggestion';
