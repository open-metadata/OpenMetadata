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

export const SettingsSliders: FC<Props> = ({
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
      d="M2 5.559h2.667M2 14.445h5.333m8.001 0h2.667m-5.335-8.886h5.333M4.666 5.557c0-.828 0-1.242.135-1.569.18-.436.527-.782.962-.962.327-.135.741-.135 1.57-.135.828 0 1.242 0 1.569.135.435.18.782.526.962.962.135.327.135.741.135 1.57 0 .828 0 1.242-.135 1.569-.18.435-.527.781-.962.962-.327.135-.741.135-1.57.135-.828 0-1.242 0-1.569-.135a1.78 1.78 0 0 1-.962-.962c-.135-.327-.135-.741-.135-1.57ZM10 14.448c0-.828 0-1.243.135-1.57.18-.435.527-.781.962-.962.327-.135.741-.135 1.57-.135.828 0 1.242 0 1.569.135.435.181.782.527.962.963.135.326.135.74.135 1.569 0 .828 0 1.242-.135 1.57a1.78 1.78 0 0 1-.962.961c-.327.136-.741.136-1.57.136-.828 0-1.242 0-1.569-.136a1.78 1.78 0 0 1-.962-.962C10 15.69 10 15.277 10 14.447Z"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
SettingsSliders.displayName = 'SettingsSliders';
