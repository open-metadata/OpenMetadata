/*
 *  Copyright 2026 Collate.
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

import { ArticleCardItem } from '../../components/ContextCenter/ArticleCard/ArticleCard.interface';
import { DocFolder } from '../../components/ContextCenter/DocumentsView/DocumentsView.interface';
import { UploadedDocumentItem } from '../../components/ContextCenter/UploadedDocumentCard/UploadedDocumentCard.interface';

export const MOCK_ARTICLES: ArticleCardItem[] = [
  {
    badge: 'sensitive',
    description:
      'Detailed guidelines for regulatory compliance across EMEA and...',
    id: '1',
    lastEditedAt: Date.now() - 7200000,
    tags: [{ label: 'Compliance' }, { label: 'Legal' }],
    title: 'Q3 Compliance Protocols v4',
  },
  {
    badge: 'new',
    description:
      'Developer quick-start guide for integrating the Context API into...',
    id: '2',
    lastEditedAt: Date.now() - 18000000,
    tags: [{ label: 'DevDocs' }, { label: 'Tech' }],
    title: 'Internal API Documentation',
  },
  {
    badge: 'new',
    description:
      'Developer quick-start guide for integrating Context API into...',
    id: '3',
    lastEditedAt: Date.now() - 18000000,
    tags: [{ label: 'DevDocs' }, { label: 'Tech' }],
    title: 'Internal API Documentation',
  },
  {
    badge: 'sensitive',
    description:
      'Detailed guidelines for regulatory compliance across EMEA and...',
    id: '4',
    lastEditedAt: Date.now() - 7200000,
    tags: [{ label: 'Compliance' }, { label: 'Legal' }],
    title: 'Q3 Compliance Protocols v4',
  },
  {
    badge: 'sensitive',
    description:
      'Detailed guidelines for regulatory compliance across EMEA and...',
    id: '5',
    lastEditedAt: Date.now() - 7200000,
    tags: [{ label: 'Compliance' }, { label: 'Legal' }],
    title: 'Q3 Compliance Protocols v4',
  },
  {
    badge: 'sensitive',
    description:
      'Detailed guidelines for regulatory compliance across EMEA and...',
    id: '6',
    lastEditedAt: Date.now() - 7200000,
    tags: [{ label: 'Compliance' }, { label: 'Legal' }],
    title: 'Q3 Compliance Protocols v4',
  },
];

export const MOCK_FOLDERS: DocFolder[] = [
  {
    files: [
      {
        fileType: 'pdf',
        id: 'f1-1',
        name: 'Q4_Revenue_Report.pdf',
        sizeLabel: '2.4 MB',
        uploadedAt: '4 hours ago',
        uploadedBy: 'Phoenix Baker',
      },
      {
        fileType: 'xlsx',
        id: 'f1-2',
        name: 'Annual_Budget_2025.xlsx',
        sizeLabel: '1.8 MB',
        uploadedAt: '1 day ago',
        uploadedBy: 'Olivia Rhye',
      },
    ],
    id: 'f1',
    name: 'Financial Reports',
  },
  {
    files: [
      {
        fileType: 'xlsx',
        id: 'f2-1',
        name: 'Customer_Data_Export.xlsx',
        sizeLabel: '5.2 MB',
        uploadedAt: '2 days ago',
        uploadedBy: 'Lana Steiner',
      },
      {
        fileType: 'csv',
        id: 'f2-2',
        name: 'Sales_Schema_v2.csv',
        sizeLabel: '340 KB',
        uploadedAt: '8 hours ago',
        uploadedBy: 'Demi Wilkinson',
      },
    ],
    id: 'f2',
    name: 'Data Exports',
  },
  {
    files: [
      {
        fileType: 'pdf',
        id: 'f3-1',
        name: 'GDPR_Compliance_Audit.pdf',
        sizeLabel: '3.1 MB',
        uploadedAt: '3 days ago',
        uploadedBy: 'Candice Wu',
      },
      {
        fileType: 'pdf',
        id: 'f3-2',
        name: 'SOC2_Report_2024.pdf',
        sizeLabel: '8.7 MB',
        uploadedAt: '1 day ago',
        uploadedBy: 'Olivia Rhye',
      },
    ],
    id: 'f3',
    name: 'Compliance',
  },
  {
    files: [
      {
        fileType: 'xlsx',
        id: 'f4-1',
        name: 'Employee_Records.xlsx',
        sizeLabel: '12 MB',
        uploadedAt: 'Just now',
        uploadedBy: 'Phoenix Baker',
      },
    ],
    id: 'f4',
    name: 'Training Materials',
  },
];

export const MOCK_DOCUMENTS: UploadedDocumentItem[] = [
  {
    fileType: 'doc',
    id: 'd1',
    name: 'Annual_Report_2023...',
    sizeLabel: '4.2 MB',
    status: 'processed',
  },
  {
    fileType: 'pdf',
    id: 'd2',
    name: 'Product_Pricing_Final...',
    sizeLabel: '128 KB',
    status: 'processed',
  },
  {
    fileType: 'image',
    id: 'd3',
    name: 'Office_Layout_Mocku...',
    sizeLabel: '2.1 MB',
    status: 'processed',
  },
  {
    fileType: 'xls',
    id: 'd4',
    name: 'Marketing_Overview_...',
    sizeLabel: '18.5 MB',
    status: 'analyzing',
  },
  {
    fileType: 'doc',
    id: 'd5',
    name: 'Annual_Report_2023...',
    sizeLabel: '4.2 MB',
    status: 'processed',
  },
  {
    fileType: 'pdf',
    id: 'd6',
    name: 'Product_Pricing_Final...',
    sizeLabel: '128 KB',
    status: 'processed',
  },
  {
    fileType: 'image',
    id: 'd7',
    name: 'Office_Layout_Mocku...',
    sizeLabel: '2.1 MB',
    status: 'processed',
  },
  {
    fileType: 'xls',
    id: 'd8',
    name: 'Marketing_Overview_...',
    sizeLabel: '18.5 MB',
    status: 'analyzing',
  },
];
