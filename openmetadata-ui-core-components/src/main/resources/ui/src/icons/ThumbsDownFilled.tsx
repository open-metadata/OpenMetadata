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

export const ThumbsDownFilled: FC<Props> = ({
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
    viewBox="0 0 18 18"
    width={size}
    {...props}>
    <path
      className="tw:fill-bg-primary"
      d="M16 8.651a1.4 1.4 0 0 1-1.4 1.4 2.1 2.1 0 0 1-2.1-2.1v-2.8c0-1.16.94-2.1 2.1-2.1a1.4 1.4 0 0 1 1.4 1.4z"
      fill="#fff"
      stroke="currentColor"
      strokeWidth={1.3}
    />
    <path
      d="m6.565 11.937.187-.602c.153-.493.229-.74.17-.935a.7.7 0 0 0-.294-.383c-.176-.11-.441-.11-.973-.11h-.283c-1.8 0-2.699 0-3.124-.533a1.4 1.4 0 0 1-.129-.193c-.327-.594.045-1.394.788-2.995.682-1.468 1.023-2.203 1.657-2.635q.091-.063.188-.118c.667-.382 1.493-.382 3.145-.382h.358c2.002 0 3.002 0 3.624.602.622.603.622 1.572.622 3.511v.682c0 1.02 0 1.529-.18 1.995-.182.466-.528.85-1.22 1.617L8.235 14.63c-.072.08-.108.119-.14.146a.723.723 0 0 1-1.01-.064 2 2 0 0 1-.118-.163 5 5 0 0 1-.183-.274 2.67 2.67 0 0 1-.312-2.023c.019-.077.043-.156.092-.315"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
ThumbsDownFilled.displayName = 'ThumbsDownFilled';
