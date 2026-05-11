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

/* eslint-disable max-len */

import {
  Article,
  KnowledgePage,
} from '../../../interface/knowledge-center.interface';

export const KNOWLEDGE_PAGE_TAGS = [
  {
    tagFQN: 'KnowledgeCenter.HowToGuide',
    name: 'HowToGuide',
    description: 'How To Guide Quick Link or Article Tag.',
    style: {
      color: '#25d80e',
    },
    source: 'Classification',
    labelType: 'Manual',
    state: 'Confirmed',
  },
  {
    tagFQN: 'PersonalData.SpecialCategory',
    name: 'SpecialCategory',
    description:
      'GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination.',
    source: 'Classification',
    labelType: 'Derived',
    state: 'Confirmed',
  },
  {
    tagFQN: 'PII.None',
    name: 'None',
    description: 'Non PII',
    style: {},
    source: 'Classification',
    labelType: 'Derived',
    state: 'Confirmed',
  },
  {
    tagFQN: 'testing.testing_term_1',
    name: 'testing_term_1',
    displayName: 'testing_term_1',
    description: 'testing_term_1',
    style: {},
    source: 'Glossary',
    labelType: 'Manual',
    state: 'Confirmed',
  },
  {
    tagFQN: 'testing.testing_term_4',
    name: 'testing_term_4',
    displayName: 'testing_term_4',
    description: 'testing_term_4',
    style: {},
    source: 'Glossary',
    labelType: 'Manual',
    state: 'Confirmed',
  },
];

export const KNOWLEDGE_PAGE_MOCK_DATA = {
  id: '8e6427d6-98cc-4334-b2f2-15fb62bde887',
  name: 'Article_oRKYYTCu',
  fullyQualifiedName: 'Article_oRKYYTCu',
  displayName: 'OpenMetadata 1.1.0 Release UI',
  description:
    'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\n_In the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀_\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
  version: 1.2,
  updatedAt: 1695189199255,
  updatedBy: 'sachinchaurasiya87',
  href: 'http://localhost:8585/api/v1/knowledgeCenter/8e6427d6-98cc-4334-b2f2-15fb62bde887',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue:
          'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\nIn the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
        newValue:
          'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\n_In the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀_\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 1.1,
  },
  owners: [
    {
      id: '9304f330-2e9a-4513-883b-c939e29683a8',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/9304f330-2e9a-4513-883b-c939e29683a8',
    },
  ],
  followers: [
    {
      id: '9304f330-2e9a-4513-883b-c939e29683a8',
      type: 'user',
      name: 'admin',
      fullyQualifiedName: 'admin',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/9304f330-2e9a-4513-883b-c939e29683a8',
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
  pageType: 'Article',
  page: {
    publicationDate: 1726823190797,
    relatedArticles: [],
  } as unknown as Article,
  deleted: false,
  tags: KNOWLEDGE_PAGE_TAGS,
} as KnowledgePage;

export const KNOWLEDGE_PAGE_PARTIAL_MOCK_DATA = {
  id: '8e6427d6-98cc-4334-b2f2-15fb62bde887',
  name: 'Article_oRKYYTCu',
  fullyQualifiedName: 'Article_oRKYYTCu',
  displayName: 'OpenMetadata 1.1.0 Release UI',
  description: '',
  version: 1.2,
  updatedAt: 1695189199255,
  updatedBy: 'sachinchaurasiya87',
  href: 'http://localhost:8585/api/v1/knowledgeCenter/8e6427d6-98cc-4334-b2f2-15fb62bde887',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue:
          'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\nIn the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
        newValue:
          'Less than two months have passed since our exciting OpenMetadata 1.0 Release, and we’re thrilled to announce the completion of Release 1.1 already! The OpenMetadata community thrives on pushing our limits; this latest release is a testament to it. Prepare to be amazed as we unveil a complete UI overhaul, meticulously designed to elevate the user experience across the entire platform. But that’s not all! We’ve also introduced four new connectors, implemented advanced PII masking, and significantly enhanced lineage parsing capabilities, just to name a few of the numerous features we’ve packed into this release. Stay tuned for an exceptional OpenMetadata experience like never before!\n\n_In the upcoming 1.2 Release of OpenMetadata, we are thrilled to introduce exclusive new features specifically tailored for Collate SaaS. You can review Collate’s roadmap here and be as excited as we are 🚀_\n\nCommunity Updates\n-----------------\n\nThanks to the incredible OpenMetadata Community, our growth and activity have skyrocketed. Slack is buzzing with constant engagement, and we truly appreciate your code contributions, feedback, and feature requests. Our webinars are attracting more attendees, and the June community meeting was extra special, thanks to our first Community Spotlight: Gaétan Soulas from Solocal!\n\nWe are excited about our soaring community numbers!\n\nCrossed 2400+ GitHub stars (+200 stars since the previous release)\n\nThe Slack community reached 3200+ members (+500 since the previous release)\n\n168 Open-source GitHub developers (+8 since the previous release)\n\nMerged 526 Commits into the 1.1 Release\n\nOpenMetadata 1.1 Release Highlights\n\nUI Overhaul\n-----------\n\nThis release marks a significant milestone for the OpenMetadata platform, bringing many UI changes that are among the most substantial since the start of the project in 2021.\n\nOur primary focus is to simplify the overall experience for users while building upon our already exceptional UI. We are incredibly excited to share these changes with you as they further enhance the platform’s discovery, collaboration, and data quality experience.\n\nRefined Landing Page\n--------------------',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 1.1,
  },
  pageType: 'Article',
  page: {
    publicationDate: 1726823190797,
    relatedArticles: [],
  } as unknown as Article,
  deleted: false,
} as KnowledgePage;

export const QUICK_LINK_MOCK_DATA = {
  id: 'fea97e8c-b2ac-4103-b827-29530d1292ad',
  name: 'QuickLink_AOJs37ZW',
  fullyQualifiedName: 'QuickLink_AOJs37ZW',
  displayName: 'OpenMetadata Docs updated',
  description: 'Quick Link for OpenMetadata Website updated.',
  href: 'http://sandbox-beta.open-metadata.org/api/v1/knowledgeCenter/fea97e8c-b2ac-4103-b827-29530d1292ad',
  changeDescription: {
    fieldsAdded: [
      {
        name: 'tags',
        newValue:
          '[{"tagFQN":"testing.testing_term_1","name":"testing_term_1","displayName":"testing_term_1","description":"testing_term_1","style":{},"source":"Glossary","labelType":"Manual","state":"Confirmed"},{"tagFQN":"testing.testing_term_4","name":"testing_term_4","displayName":"testing_term_4","description":"testing_term_4","style":{},"source":"Glossary","labelType":"Manual","state":"Confirmed"}]',
      },
    ],
    fieldsUpdated: [],
    fieldsDeleted: [
      {
        name: 'tags',
        oldValue:
          '[{"tagFQN":"testing.testing_term_2","name":"testing_term_2","displayName":"testing_term_2","description":"testing_term_2","style":{},"source":"Glossary","labelType":"Manual","state":"Confirmed"}]',
      },
    ],
    previousVersion: 0.6,
  },
  owners: [
    {
      id: 'fcc81c9c-1ca2-4ab6-a44f-722c436c7aa8',
      type: 'user',
      name: 'rupesh',
      fullyQualifiedName: 'rupesh',
      description:
        'Amundsen is one of the OSS Data Catalogs that was developed by Lyft and was open-sourced in October 2019. It quickly became popular for solving data discovery and data governance challenges. However, in recent years, Amundsen’s development and growth have slowed down considerably. Without an active community and no clear roadmap to address the emerging needs, the users of Amundsen are looking for alternatives in the OSS space.\n\nOpenMetadata is redefining the modern metadata platform with a bold vision. We have built a centralized metadata repository based on metadata specifications and APIs from the ground up. It is the foundation for innovation with several applications, such as Discovery, Collaboration, Governance, Data Quality, and Data Insights going beyond passive Data Catalogs. Learn more about OpenMetadata’s journey so far here.',
      displayName: 'Rupesh Chavan',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/users/fcc81c9c-1ca2-4ab6-a44f-722c436c7aa8',
    },
  ],
  followers: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
  tags: [
    {
      tagFQN: 'KnowledgeCenter.HowToGuide',
      name: 'HowToGuide',
      description: 'How To Guide Quick Link or Article Tag.',
      style: {
        color: '#25d80e',
      },
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'PersonalData.SpecialCategory',
      name: 'SpecialCategory',
      description:
        'GDPR special category data is personal information of data subjects that is especially sensitive, the exposure of which could significantly impact the rights and freedoms of data subjects and potentially be used against them for unlawful discrimination.',
      source: 'Classification',
      labelType: 'Derived',
      state: 'Confirmed',
    },
    {
      tagFQN: 'PII.None',
      name: 'None',
      description: 'Non PII',
      style: {},
      source: 'Classification',
      labelType: 'Derived',
      state: 'Confirmed',
    },
    {
      tagFQN: 'testing.testing_term_1',
      name: 'testing_term_1',
      displayName: 'testing_term_1',
      description: 'testing_term_1',
      style: {},
      source: 'Glossary',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'testing.testing_term_4',
      name: 'testing_term_4',
      displayName: 'testing_term_4',
      description: 'testing_term_4',
      style: {},
      source: 'Glossary',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  pageType: 'QuickLink',
  page: {
    url: 'https://open-metadata.org',
  },
  deleted: false,
} as unknown as KnowledgePage;
