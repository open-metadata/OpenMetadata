import { Status } from '../generated/entity/data/glossaryTerm';

export const mockedAssetData = {
  currPage: 1,
  data: [],
  total: 0,
};

export const mockedGlossaryTerms = [
  {
    id: 'a5a97523-2229-41e5-abbe-65f61a534c34',
    name: 'Clothing',
    displayName: 'Clothing',
    description: '',
    fullyQualifiedName: 'Business Glossary.Clothing',
    synonyms: [],
    glossary: {
      id: 'mocked-glossary-id',
      type: 'glossary',
      name: 'Mock Glossary',
      description: '',
      displayName: 'Mock Glossary',
      deleted: false,
    },
    children: [],
    relatedTerms: [],
    references: [],
    version: 1.3,
    updatedAt: 1647931273177,
    updatedBy: 'anonymous',
    reviewers: [
      {
        deleted: false,
        displayName: 'Mocked User',
        id: 'mocked-user-id',
        name: 'mocked_user',
        type: 'user',
      },
    ],
    tags: [],
    changeDescription: {
      fieldsAdded: [],
      fieldsUpdated: [],
      fieldsDeleted: [],
      previousVersion: 1,
    },
    status: 'Draft' as Status,
    deleted: false,
  },
];

export const mockedGlossaries = [
  {
    children: mockedGlossaryTerms,
    deleted: false,
    displayName: 'Mocked Glossary',
    id: 'mocked-glossary-id',
    name: 'Mock Glossary',
    owner: {
      deleted: false,
      displayName: 'Mocked User',
      id: 'mocked-user-id',
      name: 'mocked_user',
      type: 'user',
    },
    reviewers: [],
    tags: [],
    updatedAt: 1234567890,
    updatedBy: 'mocked_user',
    version: 0.1,
  },
];
