/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

/* eslint-disable max-len */

export const LATEST_VERSION_ID = 2;

const dummyImg = 'https://via.placeholder.com/725x278';

// for youtube video make isImage = false and path = {video embed id}
// embed:- youtube video => share => click on embed and take id of it

export const WHATS_NEW = [
  {
    id: 0,
    version: 'v4.00',
    description: 'Released on 4 Aug 2021.',
    features: [
      {
        title: 'lorem ipsum v4.00',
        description: `It is a long established fact that a reader will be distracted by the readable content
        of a page when looking at its layout. The point of using Lorem Ipsum is that it has a
           more-or-less normal distribution of letters, as opposed to using 'Content here, content
            here', making it look like readable English. Many desktop publishing packages and web
             page editors now use Lorem Ipsum as their default model text, and a search for 'lorem
             ipsum' will uncover many web sites still in their infancy.`,
        isImage: true,
        path: dummyImg,
      },
      {
        title: 'lorem ipsum v4.00',
        description: `It is a long established fact that a reader will be distracted by the readable content
        of a page when looking at its layout. The point of using Lorem Ipsum is that it has a
           more-or-less normal distribution of letters, as opposed to using 'Content here, content
            here', making it look like readable English. Many desktop publishing packages and web
             page editors now use Lorem Ipsum as their default model text, and a search for 'lorem
             ipsum' will uncover many web sites still in their infancy.`,
        isImage: true,
        path: dummyImg,
      },
    ],
    changeLogs: {
      highlight: `- Added experimental, opt-in CSS Grid support\n- Added support for responsive offcanvas components in navbars\n- Added new placeholders component for skeleton loading screens\n- Added support for horizontal collapsing in the collapse component\n- Added new stack and vertical rule helpers\n- Added tons of new CSS variables for body styles, colors, RGB colors, and more\n- Updated .bg-* and .text-* utilities to use CSS variables and new RGB CSS variables for real-time customization`,
      bugFix: `- [#31813](https://www.github.com): Add optional CSS grid\n- [#31859](https://github.com): Add a "skeletons" component\n- [#32319](https://github.com): Add maps for all colors, document how to extend color utilities\n- [#33403](https://github.com): modal: change data-dismiss so that it can be outside of a modal using bs-target\n- [#33781](https://github.com): Add utility classes for opacity\n- [#33986](https://github.com): New helpers: .hstack, .vstack, and .vr\n- [#34253](https://github.com): Add horizontal collapse support\n
      `,
      miscellaneous: `- [#31813](https://www.github.com): Add optional CSS grid\n- [#31859](https://github.com): Add a "skeletons" component\n- [#32319](https://github.com): Add maps for all colors, document how to extend color utilities\n- [#33403](https://github.com): modal: change data-dismiss so that it can be outside of a modal using bs-target\n- [#33781](https://github.com): Add utility classes for opacity\n- [#33986](https://github.com): New helpers: .hstack, .vstack, and .vr\n- [#34253](https://github.com): Add horizontal collapse support\n
      `,
    },
  },
  {
    id: 1,
    version: 'v4.50',
    description: 'Released on 8 Aug 2021.',
    features: [
      {
        title: 'lorem ipsum v4.50',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: true,
        path: dummyImg,
      },
      {
        title: 'lorem ipsum v4.50',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: true,
        path: dummyImg,
      },
      {
        title: 'lorem ipsum v4.50',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: true,
        path: dummyImg,
      },
      {
        title: 'lorem ipsum v4.50',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: true,
        path: dummyImg,
      },
    ],
    changeLogs: {
      highlight: `- Added experimental, opt-in CSS Grid support\n- Added support for responsive offcanvas components in navbars\n- Added new placeholders component for skeleton loading screens\n- Added support for horizontal collapsing in the collapse component\n- Added new stack and vertical rule helpers\n- Added tons of new CSS variables for body styles, colors, RGB colors, and more\n- Updated .bg-* and .text-* utilities to use CSS variables and new RGB CSS variables for real-time customization`,
      bugFix: `- [#31813](https://www.github.com): Add optional CSS grid\n- [#31859](https://github.com): Add a "skeletons" component\n- [#32319](https://github.com): Add maps for all colors, document how to extend color utilities\n- [#33403](https://github.com): modal: change data-dismiss so that it can be outside of a modal using bs-target\n- [#33781](https://github.com): Add utility classes for opacity\n- [#33986](https://github.com): New helpers: .hstack, .vstack, and .vr\n- [#34253](https://github.com): Add horizontal collapse support\n
      `,
      miscellaneous: `- [#31813](https://www.github.com): Add optional CSS grid\n- [#31859](https://github.com): Add a "skeletons" component\n- [#32319](https://github.com): Add maps for all colors, document how to extend color utilities\n- [#33403](https://github.com): modal: change data-dismiss so that it can be outside of a modal using bs-target\n- [#33781](https://github.com): Add utility classes for opacity\n- [#33986](https://github.com): New helpers: .hstack, .vstack, and .vr\n- [#34253](https://github.com): Add horizontal collapse support\n
      `,
    },
  },
  {
    id: 2,
    version: 'v5.01',
    description: 'Released on 20 Aug 2021.',
    features: [
      {
        title: 'lorem ipsum v5.01 slide 1',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: true,
        path: dummyImg,
      },
      {
        title: 'lorem ipsum v5.01 slide 2',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: false,
        path: 'jssO8-5qmag',
      },
      {
        title: 'lorem ipsum v5.01 slide 3',
        description:
          "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. ",
        isImage: true,
        path: dummyImg,
      },
    ],
    changeLogs: {
      highlight: `- Added experimental, opt-in CSS Grid support\n- Added support for responsive offcanvas components in navbars\n- Added new placeholders component for skeleton loading screens\n- Added support for horizontal collapsing in the collapse component\n- Added new stack and vertical rule helpers\n- Added tons of new CSS variables for body styles, colors, RGB colors, and more\n- Updated .bg-* and .text-* utilities to use CSS variables and new RGB CSS variables for real-time customization`,
      bugFix: `- [#31813](https://www.github.com): Add optional CSS grid\n- [#31859](https://github.com): Add a "skeletons" component\n- [#32319](https://github.com): Add maps for all colors, document how to extend color utilities\n- [#33403](https://github.com): modal: change data-dismiss so that it can be outside of a modal using bs-target\n- [#33781](https://github.com): Add utility classes for opacity\n- [#33986](https://github.com): New helpers: .hstack, .vstack, and .vr\n- [#34253](https://github.com): Add horizontal collapse support\n
      `,
      miscellaneous: `- [#31813](https://www.github.com): Add optional CSS grid\n- [#31859](https://github.com): Add a "skeletons" component\n- [#32319](https://github.com): Add maps for all colors, document how to extend color utilities\n- [#33403](https://github.com): modal: change data-dismiss so that it can be outside of a modal using bs-target\n- [#33781](https://github.com): Add utility classes for opacity\n- [#33986](https://github.com): New helpers: .hstack, .vstack, and .vr\n- [#34253](https://github.com): Add horizontal collapse support\n
      `,
    },
  },
];
