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

export const MessagingService: FC<Props> = ({
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
      d="M16.646 10.737A7.264 7.264 0 0 1 6.65 17.47a2 2 0 0 0-.308-.113.7.7 0 0 0-.176-.02c-.067 0-.14.013-.285.037l-2.872.479c-.3.05-.451.075-.56.028a.4.4 0 0 1-.212-.211c-.046-.11-.021-.26.029-.56l.478-2.872a2 2 0 0 0 .037-.285.7.7 0 0 0-.02-.177 2 2 0 0 0-.113-.307 7.264 7.264 0 0 1 6.733-9.996M5.75 10.737h.008m3.625 0h.008m3.624 0h.008m-6.869 0a.404.404 0 1 1-.807 0 .404.404 0 0 1 .807 0m3.632 0a.404.404 0 1 1-.807 0 .404.404 0 0 1 .807 0m3.632 0a.404.404 0 1 1-.807 0 .404.404 0 0 1 .807 0m1.738-7.569a1.946 1.946 0 1 1 0 3.895m1.69-2.914 1.036-.591m-1.035 2.524 1.035.591m-2.726-3.505a1.946 1.946 0 1 0 0 3.895m0 0V8.23m-1.691-4.082-1.035-.591m1.035 2.524-1.035.591m2.726-3.505V2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MessagingService.displayName = 'MessagingService';
