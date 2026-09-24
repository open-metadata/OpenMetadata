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

/* eslint-disable max-len -- SVG path data cannot be wrapped */

import { SVGProps } from 'react';

export const UniqueColumnsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    viewBox="0 0 47 47"
    xmlns="http://www.w3.org/2000/svg"
    {...props}>
    <rect
      className="tw:fill-utility-brand-50"
      height="47"
      rx="23.5"
      width="47"
      x="6.10352e-05"
    />
    <rect
      className="tw:fill-utility-brand-200"
      height="28.9231"
      rx="14.4615"
      width="28.9231"
      x="8.50534"
      y="8.50549"
    />
    <g
      className="tw:stroke-utility-brand-800"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5">
      <path d="M17.5297 29.9965L17.5297 17.0035" />
      <path d="M23.5082 29.9965L23.5082 17.0035" />
      <path d="M29.4716 29.997L29.4716 17.0037" />
      <path d="M17.4866 17.0036L29.4722 17.0036" />
      <path d="M17.4866 29.9965L29.4722 29.9965" />
    </g>
  </svg>
);

export const OccurrencesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    viewBox="0 0 47 47"
    xmlns="http://www.w3.org/2000/svg"
    {...props}>
    <rect
      className="tw:fill-utility-success-50"
      height="47"
      rx="23.5"
      width="47"
    />
    <path
      className="tw:fill-utility-success-200"
      d="M22.6322 9.29851C23.1806 9.03443 23.8194 9.03443 24.3678 9.29851L34.0621 13.9671C34.6105 14.2312 35.0088 14.7306 35.1442 15.324L37.5385 25.8141C37.674 26.4075 37.5318 27.0303 37.1523 27.5061L30.4436 35.9186C30.0641 36.3945 29.4886 36.6716 28.88 36.6716H18.12C17.5114 36.6716 16.9359 36.3945 16.5564 35.9186L9.84767 27.5061C9.46818 27.0303 9.32604 26.4075 9.46148 25.8141L11.8558 15.324C11.9912 14.7306 12.3895 14.2312 12.9379 13.9671L22.6322 9.29851Z"
    />
    <path
      className="tw:fill-utility-success-700"
      d="M19.7164 29.6795C19.99 29.9548 20.3155 30.1731 20.674 30.3217C21.0325 30.4704 21.4169 30.5464 21.805 30.5454H25.1959C25.584 30.5464 25.9685 30.4704 26.327 30.3217C26.6855 30.1731 27.011 29.9548 27.2846 29.6795L29.68 27.2841C29.9552 27.0104 30.1734 26.6849 30.322 26.3264C30.4707 25.9679 30.5467 25.5835 30.5459 25.1954V21.8046C30.5467 21.4165 30.4707 21.0321 30.322 20.6736C30.1734 20.3151 29.9552 19.9896 29.68 19.7159L27.2846 17.3205C27.011 17.0452 26.6855 16.8269 26.327 16.6783C25.9685 16.5297 25.584 16.4536 25.1959 16.4546H21.805C21.4169 16.4536 21.0325 16.5297 20.674 16.6783C20.3155 16.8269 19.99 17.0452 19.7164 17.3205L17.321 19.7159C17.0458 19.9896 16.8276 20.3151 16.6789 20.6736C16.5303 21.0321 16.4542 21.4165 16.4551 21.8046V25.1954C16.4542 25.5835 16.5303 25.9679 16.6789 26.3264C16.8276 26.6849 17.0458 27.0104 17.321 27.2841L19.7164 29.6795ZM17.8187 21.8046C17.8187 21.5956 17.8598 21.3888 17.9398 21.1957C18.0197 21.0027 18.1369 20.8273 18.2846 20.6796L20.6801 18.2841C20.8278 18.1364 21.0032 18.0192 21.1962 17.9393C21.3892 17.8593 21.5961 17.8182 21.805 17.8182H25.1959C25.4049 17.8182 25.6117 17.8593 25.8048 17.9393C25.9978 18.0192 26.1732 18.1364 26.3209 18.2841L28.7164 20.6796C28.8641 20.8273 28.9813 21.0027 29.0612 21.1957C29.1411 21.3888 29.1823 21.5956 29.1823 21.8046V25.1954C29.1823 25.4044 29.1411 25.6113 29.0612 25.8043C28.9813 25.9973 28.8641 26.1727 28.7164 26.3204L26.3209 28.7159C26.1732 28.8636 25.9978 28.9808 25.8048 29.0607C25.6117 29.1407 25.4049 29.1818 25.1959 29.1818H21.805C21.5961 29.1818 21.3892 29.1407 21.1962 29.0607C21.0032 28.9808 20.8278 28.8636 20.6801 28.7159L18.2846 26.3204C18.1369 26.1727 18.0197 25.9973 17.9398 25.8043C17.8598 25.6113 17.8187 25.4044 17.8187 25.1954V21.8046Z"
    />
    <circle
      className="tw:fill-utility-success-700"
      cx="23.5001"
      cy="23.5"
      r="1.80769"
    />
  </svg>
);

export const PendingChangesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    fill="none"
    viewBox="0 0 47 47"
    xmlns="http://www.w3.org/2000/svg"
    {...props}>
    <rect
      className="tw:fill-utility-warning-50"
      height="47"
      rx="23.5"
      width="47"
    />
    <rect
      className="tw:fill-utility-warning-200"
      height="28.9231"
      rx="14.4615"
      width="28.9231"
      x="9.03857"
      y="9.03845"
    />
    <g className="tw:stroke-utility-warning-700" strokeWidth="1.5">
      <circle cx="23.4999" cy="23.5" r="8.4359" />
      <path
        d="M22.7021 20.7413V24.7584L25.6684 26.2588"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);
