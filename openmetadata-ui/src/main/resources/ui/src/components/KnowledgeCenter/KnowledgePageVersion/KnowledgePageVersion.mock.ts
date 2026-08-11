/*
 *  Copyright 2023 Collate.
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
import {
  Article,
  KnowledgePage,
} from '../../../interface/knowledge-center.interface';

/* eslint-disable max-len */
export const MOCK_KNOWLEDGE_PAGE_VERSION_DATA = {
  id: '8e6427d6-98cc-4334-b2f2-15fb62bde887',
  name: 'Article_oRKYYTCu',
  fullyQualifiedName: 'Article_oRKYYTCu',
  href: '',
  displayName: 'OpenMetadata 1.1.0 Release UI',
  description:
    'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\nIn the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
  version: 1.1,
  updatedAt: 1695189186624,
  updatedBy: 'admin',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue:
          'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\nIn the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page',
        newValue:
          'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\nIn the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 1,
  },
  owners: [
    {
      id: '9304f330-2e9a-4513-883b-c939e29683a8',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
  ],
  followers: [
    {
      id: '9304f330-2e9a-4513-883b-c939e29683a8',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
    },
  ],
  votes: {
    upVotes: 1,
    downVotes: 0,
    upVoters: [
      {
        id: '9304f330-2e9a-4513-883b-c939e29683a8',
        type: 'user',
        name: 'admin',
        fullyQualifiedName: 'admin',
        deleted: false,
      },
    ],
    downVoters: [],
  },
  tags: [],
  pageType: 'Article',
  page: {
    publicationDate: 1726823190797,
    relatedArticles: [],
  } as unknown as Article,
  relatedEntities: [
    {
      id: '8d5ccfe5-b9d7-4f4f-8927-8e775bf77eb3',
      type: 'team',
      name: 'Organization',
      fullyQualifiedName: 'Organization',
      description:
        'Organization under which all the other team hierarchy is created',
      displayName: 'Organization',
      deleted: false,
    },
  ],
  deleted: false,
} as KnowledgePage;
