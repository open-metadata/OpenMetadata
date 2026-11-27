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

export const SampleDataButton: FC<Props> = ({
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
      d="M15.333 2H4.667c-.829 0-1.243 0-1.57.135-.435.18-.781.527-.962.962C2 3.424 2 3.838 2 4.667c0 .828 0 1.242.135 1.569.18.435.527.782.962.962.327.135.741.135 1.57.135h10.666c.829 0 1.243 0 1.57-.135.435-.18.781-.527.962-.962.135-.327.135-.741.135-1.57 0-.828 0-1.242-.135-1.569a1.78 1.78 0 0 0-.962-.962C16.576 2 16.162 2 15.333 2"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="M15.333 7.332H4.667c-.829 0-1.243 0-1.57.135-.435.18-.781.527-.962.962C2 8.756 2 9.17 2 10c0 .828 0 1.242.135 1.569.18.436.527.782.962.962.327.135.741.135 1.57.135h10.666c.829 0 1.243 0 1.57-.135.435-.18.781-.526.962-.962.135-.327.135-.74.135-1.57 0-.828 0-1.242-.135-1.569a1.78 1.78 0 0 0-.962-.962c-.327-.135-.741-.135-1.57-.135m0 5.335H4.667c-.829 0-1.243 0-1.57.135-.435.18-.781.527-.962.962C2 14.092 2 14.506 2 15.335c0 .828 0 1.242.135 1.569.18.435.527.782.962.962.327.135.741.135 1.57.135h10.666c.829 0 1.243 0 1.57-.135.435-.18.781-.527.962-.962.135-.327.135-.741.135-1.57 0-.828 0-1.242-.135-1.569a1.78 1.78 0 0 0-.962-.962c-.327-.135-.741-.135-1.57-.135m-10.667-8h.009M4.666 10h.009m-.009 5.332h.009M7.334 4.668h.009M7.334 10h.009m-.009 5.332h.009"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SampleDataButton.displayName = 'SampleDataButton';
