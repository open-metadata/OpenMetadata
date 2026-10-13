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

export const WeeklyEmailPreferences: FC<Props> = ({
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
      d="M10.843 3.688H2.422M9.159 16.32H2.422m15.158 0h-3.37m3.367-6.316h-8.42m8.426-6.316h-1.685M4.106 10.004H2.422M12.107 2c.392 0 .588 0 .743.064.207.086.37.25.456.456.064.155.064.35.064.743v.842c0 .393 0 .589-.064.744a.84.84 0 0 1-.456.455c-.155.064-.35.064-.743.064-.392 0-.589 0-.743-.064a.84.84 0 0 1-.456-.455c-.064-.155-.064-.351-.064-.744v-.842c0-.392 0-.588.064-.743a.84.84 0 0 1 .456-.456c.154-.064.35-.064.743-.064M10.42 14.633c.392 0 .588 0 .743.064a.84.84 0 0 1 .455.456c.065.154.065.35.065.743v.842c0 .392 0 .589-.065.743a.84.84 0 0 1-.455.456c-.155.064-.351.064-.744.064-.392 0-.588 0-.743-.064a.84.84 0 0 1-.456-.456c-.064-.154-.064-.35-.064-.743v-.842c0-.392 0-.589.064-.743a.84.84 0 0 1 .456-.456c.155-.064.351-.064.743-.064M7.892 8.316c.392 0 .589 0 .743.065a.84.84 0 0 1 .456.455c.064.155.064.351.064.744v.842c0 .392 0 .588-.064.743a.84.84 0 0 1-.456.456c-.154.064-.35.064-.743.064-.392 0-.588 0-.743-.064a.84.84 0 0 1-.456-.456c-.064-.155-.064-.351-.064-.743V9.58c0-.393 0-.589.064-.744a.84.84 0 0 1 .456-.455c.155-.065.35-.065.743-.065"
      stroke="currentColor"
      strokeWidth={1.3}
    />
  </svg>
);
WeeklyEmailPreferences.displayName = 'WeeklyEmailPreferences';
