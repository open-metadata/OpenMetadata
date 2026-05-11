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
export const QUICK_LINK_MOCK_DATA = {
  id: '1e62e2f6-7441-4c1b-bd15-15a23af23181',
  name: 'QuickLink_38ZC2KXX',
  fullyQualifiedName: 'QuickLink_38ZC2KXX',
  displayName: 'The Six Pillars of OpenMetadata',
  description:
    'OpenMetadata is an all-in-one platform for data discovery, lineage, data quality, observability, governance, and team collaboration. Powered by a centralized metadata store based on Open Metadata Standards/APIs, supporting connectors to a wide range of data services, OpenMetadata enables end-to-end metadata management, giving you the freedom to unlock the value of your data assets.\n\nOpenMetadata is a complete package for data teams to break down team silos, share data assets from multiple sources securely, collaborate around data, and build a documentation-first data culture in the organization.\n\nLet us learn more about the six pillars of OpenMetadata that helps maintain its ground as the best in effective metadata management:\n\n1.  Data Discovery,\n    \n2.  Data Collaboration,\n    \n3.  Data Quality and Profiler,\n    \n4.  Data Lineage,\n    \n5.  Data insights, and\n    \n6.  [**Data Governance**](https://docs.open-metadata.org/v1.1.x/how-to-guides/openmetadata/data-governance).',
  version: 0.2,
  updatedAt: 1695188836184,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/knowledgeCenter/1e62e2f6-7441-4c1b-bd15-15a23af23181',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [
      {
        name: 'description',
        oldValue: 'The Six Pillars of OpenMetadata',
        newValue:
          'OpenMetadata is an all-in-one platform for data discovery, lineage, data quality, observability, governance, and team collaboration. Powered by a centralized metadata store based on Open Metadata Standards/APIs, supporting connectors to a wide range of data services, OpenMetadata enables end-to-end metadata management, giving you the freedom to unlock the value of your data assets.\n\nOpenMetadata is a complete package for data teams to break down team silos, share data assets from multiple sources securely, collaborate around data, and build a documentation-first data culture in the organization.\n\nLet us learn more about the six pillars of OpenMetadata that helps maintain its ground as the best in effective metadata management:\n\n1.  Data Discovery,\n    \n2.  Data Collaboration,\n    \n3.  Data Quality and Profiler,\n    \n4.  Data Lineage,\n    \n5.  Data insights, and\n    \n6.  [**Data Governance**](https://docs.open-metadata.org/v1.1.x/how-to-guides/openmetadata/data-governance).',
      },
    ],
    fieldsDeleted: [],
    previousVersion: 0.1,
  },
  owner: {
    id: '9304f330-2e9a-4513-883b-c939e29683a8',
    type: 'user',
    name: 'admin',
    fullyQualifiedName: 'admin',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/9304f330-2e9a-4513-883b-c939e29683a8',
  },
  tags: [],
  pageType: 'QuickLink',
  page: {
    url: 'https://docs.open-metadata.org/v1.1.x/how-to-guides/openmetadata',
  },
  deleted: false,
};

export const MOCK_KNOWLEDGE_CENTER_TAG = {
  id: 'ea9dd24d-96de-490e-a62a-54a6ab61b1ae',
  name: 'application-customization',
  displayName: 'Application Customisation',
  fullyQualifiedName: 'KnowledgeCenter.application-customization',
  description: 'Application Customisation',
  classification: {
    id: '569009a1-b478-4142-b06a-b174c197e24a',
    type: 'classification',
    name: 'KnowledgeCenter',
    fullyQualifiedName: 'KnowledgeCenter',
    description:
      'Category describing the knowledge center articles or quickLinks. E.g., How-To-Guide, Quick-Link etc.',
    deleted: false,
    href: 'http://localhost:8585/api/v1/classifications/569009a1-b478-4142-b06a-b174c197e24a',
  },
  version: 0.1,
  updatedAt: 1695622161800,
  updatedBy: 'admin',
  href: 'http://localhost:8585/api/v1/tags/ea9dd24d-96de-490e-a62a-54a6ab61b1ae',
  deprecated: false,
  deleted: false,
  provider: 'user',
  mutuallyExclusive: false,
};
