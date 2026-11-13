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

export const MemoriesFilled: FC<Props> = ({
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
      d="M14.429 12.885v-.343C8.77 14.058 7.15 9.192 7.048 6.57c-1.067 0-2.6 0-3.008.203a1.88 1.88 0 0 0-.832.811C3 7.982 3 8.502 3 9.542v7.76c0 .33 0 .496.07.58a.32.32 0 0 0 .248.117c.111 0 .243-.103.507-.31l1.515-1.18c.31-.242.464-.363.636-.449q.23-.114.484-.165c.19-.038.387-.038.784-.038h4.137c1.067 0 1.6 0 2.008-.202.358-.178.65-.463.832-.812.208-.398.208-.918.208-1.958"
      fill="currentColor"
    />
    <path
      d="m18.143 6.778-.928.889-.929-.89m1.042.667q.026-.218.026-.444c0-2.21-1.87-4-4.177-4S9 4.79 9 7s1.87 4 4.177 4a4.24 4.24 0 0 0 3.249-1.486m-3.249-4.736V7l1.392.889"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
MemoriesFilled.displayName = 'MemoriesFilled';
