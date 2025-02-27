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
import { APIServiceType } from '../generated/entity/data/apiCollection';

import { APICollection } from '../generated/entity/data/apiCollection';
import {
  APIEndpoint,
  APIRequestMethod,
  DataTypeTopic,
  SchemaType,
} from '../generated/entity/data/apiEndpoint';

export const API_COLLECTION_DUMMY_DATA: APICollection = {
  id: 'db03ef8f-82f9-4a23-a940-3ba5af5bba29',
  name: 'pet',
  fullyQualifiedName: 'sample_api_service.pet',
  version: 0.1,
  updatedAt: 1722588116104,
  updatedBy: 'ingestion-bot',
  endpointURL: 'https://petstore3.swagger.io/#/pet',
  owners: [],
  tags: [],
  service: {
    id: '449b7937-c4ca-4dce-866c-5f6d0acc45c1',
    type: 'apiService',
    name: 'sample_api_service',
    fullyQualifiedName: 'sample_api_service',
    displayName: 'sample_api_service',
    deleted: false,
  },
  serviceType: APIServiceType.REST,
  deleted: false,
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};

export const API_ENDPOINT_DUMMY_DATA: APIEndpoint = {
  id: 'b41d3506-09ac-4e02-ae40-8d6933f6a77f',
  name: 'addPet',
  displayName: 'Add Pet',
  fullyQualifiedName: 'sample_api_service.pet.addPet',
  description: 'add a new pet',
  version: 0.5,
  updatedAt: 1723268606694,
  updatedBy: 'sachin',
  endpointURL: 'https://petstore3.swagger.io/#/pet/addPet',
  requestMethod: APIRequestMethod.Post,
  requestSchema: {
    schemaType: SchemaType.JSON,
    schemaFields: [
      {
        name: 'id',
        dataType: DataTypeTopic.Int,
        description: 'ID of pet that needs to be updated',
        fullyQualifiedName: 'sample_api_service.pet.addPet.id',
        tags: [],
      },
      {
        name: 'name',
        dataType: DataTypeTopic.String,
        description: 'Name of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.name',
        tags: [],
      },
      {
        name: 'category',
        dataType: DataTypeTopic.Record,
        description: 'Category of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.category',
        tags: [],
        children: [
          {
            name: 'id',
            dataType: DataTypeTopic.Int,
            description: 'ID of category',
            fullyQualifiedName: 'sample_api_service.pet.addPet.category.id',
            tags: [],
          },
          {
            name: 'name',
            dataType: DataTypeTopic.String,
            description: 'Name of category',
            fullyQualifiedName: 'sample_api_service.pet.addPet.category.name',
            tags: [],
          },
        ],
      },
      {
        name: 'photoUrls',
        dataType: DataTypeTopic.Array,
        description: "URLs of pet's photos",
        fullyQualifiedName: 'sample_api_service.pet.addPet.photoUrls',
        tags: [],
      },
      {
        name: 'tags',
        dataType: DataTypeTopic.Array,
        description: 'Tags of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.tags',
        tags: [],
      },
      {
        name: 'status',
        dataType: DataTypeTopic.String,
        description: 'Status of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.status',
        tags: [],
      },
    ],
  },
  responseSchema: {
    schemaType: SchemaType.JSON,
    schemaFields: [
      {
        name: 'id',
        dataType: DataTypeTopic.Int,
        description: 'ID of pet that needs to be updated',
        fullyQualifiedName: 'sample_api_service.pet.addPet.id',
        tags: [],
      },
      {
        name: 'name',
        dataType: DataTypeTopic.String,
        description: 'Name of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.name',
        tags: [],
      },
      {
        name: 'category',
        dataType: DataTypeTopic.Record,
        description: 'Category of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.category',
        tags: [],
        children: [
          {
            name: 'id',
            dataType: DataTypeTopic.Int,
            description: 'ID of category',
            fullyQualifiedName: 'sample_api_service.pet.addPet.category.id',
            tags: [],
          },
          {
            name: 'name',
            dataType: DataTypeTopic.String,
            description: 'Name of category',
            fullyQualifiedName: 'sample_api_service.pet.addPet.category.name',
            tags: [],
          },
        ],
      },
      {
        name: 'photoUrls',
        dataType: DataTypeTopic.Array,
        description: "URLs of pet's photos",
        fullyQualifiedName: 'sample_api_service.pet.addPet.photoUrls',
        tags: [],
      },
      {
        name: 'tags',
        dataType: DataTypeTopic.Array,
        description: 'Tags of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.tags',
        tags: [],
      },
      {
        name: 'status',
        dataType: DataTypeTopic.String,
        description: 'Status of pet',
        fullyQualifiedName: 'sample_api_service.pet.addPet.status',
        tags: [],
      },
    ],
  },
  apiCollection: {
    id: 'db03ef8f-82f9-4a23-a940-3ba5af5bba29',
    type: 'apiCollection',
    name: 'pet',
    fullyQualifiedName: 'sample_api_service.pet',
    displayName: 'pet',
    deleted: false,
  },
  owners: [],
  followers: [],
  tags: [],
  service: {
    id: '449b7937-c4ca-4dce-866c-5f6d0acc45c1',
    type: 'apiService',
    name: 'sample_api_service',
    fullyQualifiedName: 'sample_api_service',
    displayName: 'sample_api_service',
    deleted: false,
  },
  serviceType: APIServiceType.REST,
  deleted: false,
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
