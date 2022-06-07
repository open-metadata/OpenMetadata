/*
 *  Copyright 2021 Collate
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

/* eslint-disable max-len */
import React, { CSSProperties } from 'react';
import { TEXT_BODY_COLOR } from '../constants/constants';

export const dropdownIcon = ({ style }: { style?: CSSProperties }) => {
  return (
    <svg
      aria-hidden="true"
      className="tw-inline-block tw-h-2.5 tw-w-2.5 tw-ml-1.5"
      fill="currentColor"
      style={style}
      viewBox="0 0 11 6"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M0.740147 0H10.2599C10.9184 0 11.2477 0.764898 10.7815 1.21316L6.02353 5.79188C5.73494 6.06937 5.26506 6.06937 4.97647 5.79188L0.218469 1.21316C-0.247712 0.764898 0.0815744 0 0.740147 0Z"
        fill="#485056"
      />
    </svg>
  );
};

export const FolderIcon = (fill = TEXT_BODY_COLOR, style?: CSSProperties) => {
  return (
    <svg
      className="tw-inline-block"
      fill="none"
      height="12"
      style={style}
      viewBox="0 0 14 12"
      width="14"
      xmlns="http://www.w3.org/2000/svg">
      <path
        clipRule="evenodd"
        d="M12.3436 11.2H3.22275C2.35234 11.2 1.47919 10.5312 1.23641 9.67838L0.0642123 5.56109C-0.204093 4.6187 0.395513 3.80379 1.35772 3.80379H1.56639V1.68921C1.56639 0.756247 2.30803 0 3.22303 0H6.53882C6.91665 0 7.33205 0.244903 7.51904 0.578611L7.93815 1.32656C7.97717 1.39621 8.11772 1.47925 8.19583 1.47925H12.3408C13.2565 1.47925 14 2.23656 14 3.16881V9.51046C14 10.3701 13.3709 11.0797 12.5565 11.1862C12.4955 11.1943 12.4327 11.1989 12.3682 11.1999C12.36 11.1999 12.3518 11.2 12.3436 11.2ZM13.1711 7.80572V3.16881C13.1711 2.7036 12.799 2.32454 12.3408 2.32454H8.19583C7.82043 2.32454 7.40515 2.07912 7.21844 1.74593L6.79933 0.997981C6.76017 0.928114 6.61969 0.84529 6.5388 0.84529H3.22301C2.76581 0.84529 2.39528 1.22309 2.39528 1.68921V3.80377H10.4786C11.349 3.80377 12.2221 4.4726 12.4649 5.32539L13.1711 7.80572ZM0.86027 5.32541C0.745872 4.92361 0.947866 4.64906 1.35772 4.64906H10.4786C10.9802 4.64906 11.5289 5.0694 11.6689 5.56109L12.8411 9.67838C12.9555 10.0802 12.7534 10.3547 12.3436 10.3547H3.22275C2.72115 10.3547 2.17242 9.93439 2.03245 9.4427L0.86027 5.32541Z"
        fill={fill}
        fillRule="evenodd"
      />
    </svg>
  );
};

export const FileIcon = (fill = TEXT_BODY_COLOR, style?: CSSProperties) => {
  return (
    <svg
      className="tw-inline-block"
      fill="none"
      height="14"
      style={style}
      viewBox="0 0 12 14"
      width="12"
      xmlns="http://www.w3.org/2000/svg">
      <path
        d="M11.2939 3.40134L8.01272 0.120176C7.93613 0.0435586 7.83159 0 7.72266 0H1.98047C1.30199 0 0.75 0.551988 0.75 1.23047V12.7695C0.75 13.448 1.30199 14 1.98047 14H10.1836C10.8621 14 11.4141 13.448 11.4141 12.7695V3.69141C11.4141 3.57957 11.3671 3.47454 11.2939 3.40134ZM8.13281 1.40036L10.0137 3.28125H8.54297C8.31681 3.28125 8.13281 3.09725 8.13281 2.87109V1.40036ZM10.1836 13.1797H1.98047C1.75431 13.1797 1.57031 12.9957 1.57031 12.7695V1.23047C1.57031 1.00431 1.75431 0.820312 1.98047 0.820312H7.3125V2.87109C7.3125 3.54957 7.86449 4.10156 8.54297 4.10156H10.5938V12.7695C10.5938 12.9957 10.4098 13.1797 10.1836 13.1797Z"
        fill={fill}
      />
      <path
        d="M8.54297 5.79688H3.62109C3.39458 5.79688 3.21094 5.98052 3.21094 6.20703C3.21094 6.43355 3.39458 6.61719 3.62109 6.61719H8.54297C8.76948 6.61719 8.95312 6.43355 8.95312 6.20703C8.95312 5.98052 8.76948 5.79688 8.54297 5.79688Z"
        fill={fill}
      />
      <path
        d="M8.54297 8H3.62109C3.39458 8 3.21094 8.18364 3.21094 8.41016C3.21094 8.63667 3.39458 8.82031 3.62109 8.82031H8.54297C8.76948 8.82031 8.95312 8.63667 8.95312 8.41016C8.95312 8.18364 8.76948 8 8.54297 8Z"
        fill={fill}
      />
      <path
        d="M6.90234 10H3.62109C3.39458 10 3.21094 10.1836 3.21094 10.4102C3.21094 10.6367 3.39458 10.8203 3.62109 10.8203H6.90234C7.12886 10.8203 7.3125 10.6367 7.3125 10.4102C7.3125 10.1836 7.12886 10 6.90234 10Z"
        fill={fill}
      />
    </svg>
  );
};
