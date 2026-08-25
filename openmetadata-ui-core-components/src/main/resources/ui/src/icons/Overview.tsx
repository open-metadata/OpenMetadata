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

export const Overview: FC<Props> = ({
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
      d="M6.8 2H3.422c-.498 0-.747 0-.937.097a.9.9 0 0 0-.388.388C2 2.675 2 2.925 2 3.422V6.8c0 .498 0 .747.097.937a.9.9 0 0 0 .388.388c.19.097.44.097.937.097H6.8c.498 0 .747 0 .937-.097a.9.9 0 0 0 .388-.388c.097-.19.097-.44.097-.937V3.422c0-.498 0-.747-.097-.937a.9.9 0 0 0-.388-.388C7.547 2 7.297 2 6.8 2m9.778 0H13.2c-.498 0-.747 0-.937.097a.9.9 0 0 0-.388.388c-.097.19-.097.44-.097.937V6.8c0 .498 0 .747.097.937a.9.9 0 0 0 .388.388c.19.097.44.097.937.097h3.378c.498 0 .747 0 .937-.097a.9.9 0 0 0 .388-.388C18 7.547 18 7.297 18 6.8V3.422c0-.498 0-.747-.097-.937a.9.9 0 0 0-.388-.388C17.325 2 17.075 2 16.578 2m0 9.778H13.2c-.498 0-.747 0-.937.097a.9.9 0 0 0-.388.388c-.097.19-.097.44-.097.937v3.378c0 .498 0 .747.097.937a.9.9 0 0 0 .388.388c.19.097.44.097.937.097h3.378c.498 0 .747 0 .937-.097a.9.9 0 0 0 .388-.388c.097-.19.097-.44.097-.937V13.2c0-.498 0-.747-.097-.937a.9.9 0 0 0-.388-.388c-.19-.097-.44-.097-.937-.097m-9.778 0H3.422c-.498 0-.747 0-.937.097a.9.9 0 0 0-.388.388C2 12.453 2 12.703 2 13.2v3.378c0 .498 0 .747.097.937a.9.9 0 0 0 .388.388c.19.097.44.097.937.097H6.8c.498 0 .747 0 .937-.097a.9.9 0 0 0 .388-.388c.097-.19.097-.44.097-.937V13.2c0-.498 0-.747-.097-.937a.9.9 0 0 0-.388-.388c-.19-.097-.44-.097-.937-.097"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
Overview.displayName = 'Overview';
