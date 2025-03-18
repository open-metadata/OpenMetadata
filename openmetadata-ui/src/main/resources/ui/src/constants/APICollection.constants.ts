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
import {
  APICollection,
  APIServiceType,
} from '../generated/entity/data/apiCollection';
import {
  APIEndpoint,
  APIRequestMethod,
  DataTypeTopic,
} from '../generated/entity/data/apiEndpoint';

export const API_COLLECTION_DUMMY_DATA: APICollection = {
  id: 'a5580b17-739b-4f86-b72a-96eb5c59de6f',
  name: 'store',
  displayName: 'Store',
  fullyQualifiedName: 'pet_api_service.store',
  description: 'Access to Petstore orders',
  version: 0.1,
  updatedAt: 1728661471889,
  updatedBy: 'ingestion-bot',
  endpointURL: 'https://petstore3.swagger.io/api/v3/openapi.json#tag/store',
  owners: [],
  tags: [],
  service: {
    id: 'c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
    type: 'apiService',
    name: 'pet_api_service',
    fullyQualifiedName: 'pet_api_service',
    description: '',
    displayName: 'pet_api_service',
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
  sourceHash: '6d27d7b7b574599ecbbd651530b164c0',
};

export const API_COLLECTION_API_ENDPOINTS: APIEndpoint[] = [
  {
    id: 'eb95db42-9b0d-46e0-945d-dc6a4e115692',
    name: 'deleteOrder',
    fullyQualifiedName: 'pet_api_service.store.deleteOrder',
    description:
      'For valid response try integer IDs with value < 1000. Anything above 1000 or nonintegers will generate API errors',
    version: 0.1,
    updatedAt: 1728661472246,
    updatedBy: 'ingestion-bot',
    endpointURL:
      'https://petstore3.swagger.io/api/v3/openapi.json#operation/deleteOrder',
    requestMethod: APIRequestMethod.Delete,
    apiCollection: {
      id: 'a5580b17-739b-4f86-b72a-96eb5c59de6f',
      type: 'apiCollection',
      name: 'store',
      fullyQualifiedName: 'pet_api_service.store',
      description: 'Access to Petstore orders',
      displayName: 'store',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/apiCollections/a5580b17-739b-4f86-b72a-96eb5c59de6f',
    },
    href: 'http://sandbox-beta.open-metadata.org/api/v1/apiEndpoints/eb95db42-9b0d-46e0-945d-dc6a4e115692',
    owners: [],
    service: {
      id: 'c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
      type: 'apiService',
      name: 'pet_api_service',
      fullyQualifiedName: 'pet_api_service',
      description: '',
      displayName: 'pet_api_service',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/apiServices/c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
    },
    serviceType: APIServiceType.REST,
    deleted: false,
    sourceHash: '3bb38027ff9e2aea7158b96daa7fe9d5',
  },
  {
    id: '24f70b58-d285-4f5e-881e-8d27076a3050',
    name: 'getInventory',
    fullyQualifiedName: 'pet_api_service.store.getInventory',
    description: 'Returns a map of status codes to quantities',
    version: 0.1,
    updatedAt: 1728661471960,
    updatedBy: 'ingestion-bot',
    endpointURL:
      'https://petstore3.swagger.io/api/v3/openapi.json#operation/getInventory',
    requestMethod: APIRequestMethod.Get,
    apiCollection: {
      id: 'a5580b17-739b-4f86-b72a-96eb5c59de6f',
      type: 'apiCollection',
      name: 'store',
      fullyQualifiedName: 'pet_api_service.store',
      description: 'Access to Petstore orders',
      displayName: 'store',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/apiCollections/a5580b17-739b-4f86-b72a-96eb5c59de6f',
    },
    href: 'http://sandbox-beta.open-metadata.org/api/v1/apiEndpoints/24f70b58-d285-4f5e-881e-8d27076a3050',
    owners: [],
    service: {
      id: 'c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
      type: 'apiService',
      name: 'pet_api_service',
      fullyQualifiedName: 'pet_api_service',
      description: '',
      displayName: 'pet_api_service',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/apiServices/c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
    },
    serviceType: APIServiceType.REST,
    deleted: false,
    sourceHash: '7393abcf9a61ffcf689afbc1e16f043c',
  },
  {
    id: '80cebee6-c433-4aca-be10-00835607f434',
    name: 'getOrderById',
    fullyQualifiedName: 'pet_api_service.store.getOrderById',
    description:
      'For valid response try integer IDs with value <= 5 or > 10. Other values will generate exceptions.',
    version: 0.1,
    updatedAt: 1728661472148,
    updatedBy: 'ingestion-bot',
    endpointURL:
      'https://petstore3.swagger.io/api/v3/openapi.json#operation/getOrderById',
    requestMethod: APIRequestMethod.Get,
    responseSchema: {
      schemaFields: [
        {
          name: 'id',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.getOrderById.responseSchema.id',
        },
        {
          name: 'petId',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.getOrderById.responseSchema.petId',
        },
        {
          name: 'quantity',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.getOrderById.responseSchema.quantity',
        },
        {
          name: 'shipDate',
          dataType: DataTypeTopic.String,
          fullyQualifiedName:
            'pet_api_service.store.getOrderById.responseSchema.shipDate',
        },
        {
          name: 'status',
          dataType: DataTypeTopic.String,
          fullyQualifiedName:
            'pet_api_service.store.getOrderById.responseSchema.status',
        },
        {
          name: 'complete',
          dataType: DataTypeTopic.Boolean,
          fullyQualifiedName:
            'pet_api_service.store.getOrderById.responseSchema.complete',
        },
      ],
    },
    apiCollection: {
      id: 'a5580b17-739b-4f86-b72a-96eb5c59de6f',
      type: 'apiCollection',
      name: 'store',
      fullyQualifiedName: 'pet_api_service.store',
      description: 'Access to Petstore orders',
      displayName: 'store',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/apiCollections/a5580b17-739b-4f86-b72a-96eb5c59de6f',
    },
    href: 'http://sandbox-beta.open-metadata.org/api/v1/apiEndpoints/80cebee6-c433-4aca-be10-00835607f434',
    owners: [],
    service: {
      id: 'c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
      type: 'apiService',
      name: 'pet_api_service',
      fullyQualifiedName: 'pet_api_service',
      description: '',
      displayName: 'pet_api_service',
      deleted: false,
      href: 'http://sandbox-beta.open-metadata.org/api/v1/services/apiServices/c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
    },
    serviceType: APIServiceType.REST,
    deleted: false,
    sourceHash: '80a3d7e39db6c11cb99369cec2b93ddd',
  },
  {
    id: '41c77483-0122-45f5-9387-1318c4c36851',
    name: 'placeOrder',
    fullyQualifiedName: 'pet_api_service.store.placeOrder',
    description: 'Place a new order in the store',
    version: 0.1,
    updatedAt: 1728661472057,
    updatedBy: 'ingestion-bot',
    endpointURL:
      'https://petstore3.swagger.io/api/v3/openapi.json#operation/placeOrder',
    requestMethod: APIRequestMethod.Post,
    requestSchema: {
      schemaFields: [
        {
          name: 'id',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.requestSchema.id',
        },
        {
          name: 'petId',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.requestSchema.petId',
        },
        {
          name: 'quantity',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.requestSchema.quantity',
        },
        {
          name: 'shipDate',
          dataType: DataTypeTopic.String,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.requestSchema.shipDate',
        },
        {
          name: 'status',
          dataType: DataTypeTopic.String,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.requestSchema.status',
        },
        {
          name: 'complete',
          dataType: DataTypeTopic.Boolean,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.requestSchema.complete',
        },
      ],
    },
    responseSchema: {
      schemaFields: [
        {
          name: 'id',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.responseSchema.id',
        },
        {
          name: 'petId',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.responseSchema.petId',
        },
        {
          name: 'quantity',
          dataType: DataTypeTopic.Unknown,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.responseSchema.quantity',
        },
        {
          name: 'shipDate',
          dataType: DataTypeTopic.String,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.responseSchema.shipDate',
        },
        {
          name: 'status',
          dataType: DataTypeTopic.String,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.responseSchema.status',
        },
        {
          name: 'complete',
          dataType: DataTypeTopic.Boolean,
          fullyQualifiedName:
            'pet_api_service.store.placeOrder.responseSchema.complete',
        },
      ],
    },
    apiCollection: {
      id: 'a5580b17-739b-4f86-b72a-96eb5c59de6f',
      type: 'apiCollection',
      name: 'store',
      fullyQualifiedName: 'pet_api_service.store',
      description: 'Access to Petstore orders',
      displayName: 'store',
      deleted: false,
    },

    owners: [],
    service: {
      id: 'c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
      type: 'apiService',
      name: 'pet_api_service',
      fullyQualifiedName: 'pet_api_service',
      description: '',
      displayName: 'pet_api_service',
      deleted: false,
    },
    serviceType: APIServiceType.REST,
    deleted: false,
    sourceHash: 'b096ec9bdd3c7da381f6f5ee57049da6',
  },
];

export const API_ENDPOINT_DUMMY_DATA: APIEndpoint = {
  id: '08063869-2e79-4ad1-8d58-749ccf7b8d06',
  name: 'addPet',
  fullyQualifiedName: 'pet_api_service.pet.addPet',
  description: 'Add a new pet to the store',
  version: 0.2,
  updatedAt: 1739265637241,
  updatedBy: 'ingestion-bot',
  endpointURL:
    'https://petstore3.swagger.io/api/v3/openapi.json#operation/addPet',
  requestMethod: APIRequestMethod.Post,
  requestSchema: {
    schemaFields: [
      {
        name: 'id',
        dataType: DataTypeTopic.Unknown,
        fullyQualifiedName: 'pet_api_service.pet.addPet.requestSchema.id',
        tags: [],
      },
      {
        name: 'name',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'pet_api_service.pet.addPet.requestSchema.name',
        tags: [],
      },
      {
        name: 'category',
        dataType: DataTypeTopic.Unknown,
        fullyQualifiedName: 'pet_api_service.pet.addPet.requestSchema.category',
        tags: [],
        children: [
          {
            name: 'id',
            dataType: DataTypeTopic.Unknown,
            fullyQualifiedName:
              'pet_api_service.pet.addPet.requestSchema.category.id',
            tags: [],
          },
          {
            name: 'name',
            dataType: DataTypeTopic.String,
            fullyQualifiedName:
              'pet_api_service.pet.addPet.requestSchema.category.name',
            tags: [],
          },
        ],
      },
      {
        name: 'photoUrls',
        dataType: DataTypeTopic.Array,
        fullyQualifiedName:
          'pet_api_service.pet.addPet.requestSchema.photoUrls',
        tags: [],
      },
      {
        name: 'tags',
        dataType: DataTypeTopic.Array,
        fullyQualifiedName: 'pet_api_service.pet.addPet.requestSchema.tags',
        tags: [],
      },
      {
        name: 'status',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'pet_api_service.pet.addPet.requestSchema.status',
        tags: [],
      },
    ],
  },
  responseSchema: {
    schemaFields: [
      {
        name: 'id',
        dataType: DataTypeTopic.Unknown,
        fullyQualifiedName: 'pet_api_service.pet.addPet.responseSchema.id',
        tags: [],
      },
      {
        name: 'name',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'pet_api_service.pet.addPet.responseSchema.name',
        tags: [],
      },
      {
        name: 'category',
        dataType: DataTypeTopic.Unknown,
        fullyQualifiedName:
          'pet_api_service.pet.addPet.responseSchema.category',
        tags: [],
        children: [
          {
            name: 'id',
            dataType: DataTypeTopic.Unknown,
            fullyQualifiedName:
              'pet_api_service.pet.addPet.responseSchema.category.id',
            tags: [],
          },
          {
            name: 'name',
            dataType: DataTypeTopic.String,
            fullyQualifiedName:
              'pet_api_service.pet.addPet.responseSchema.category.name',
            tags: [],
          },
        ],
      },
      {
        name: 'photoUrls',
        dataType: DataTypeTopic.Array,
        fullyQualifiedName:
          'pet_api_service.pet.addPet.responseSchema.photoUrls',
        tags: [],
      },
      {
        name: 'tags',
        dataType: DataTypeTopic.Array,
        fullyQualifiedName: 'pet_api_service.pet.addPet.responseSchema.tags',
        tags: [],
      },
      {
        name: 'status',
        dataType: DataTypeTopic.String,
        fullyQualifiedName: 'pet_api_service.pet.addPet.responseSchema.status',
        tags: [],
      },
    ],
  },
  apiCollection: {
    id: 'f215a721-5fc2-4126-bb89-d83e20fab161',
    type: 'apiCollection',
    name: 'pet',
    fullyQualifiedName: 'pet_api_service.pet',
    description: 'Everything about your Pets',
    displayName: 'pet',
    deleted: false,
  },

  owners: [],
  followers: [],
  tags: [],
  service: {
    id: 'c5d3b9ff-c8b4-4d3c-a695-7e94c798e3f8',
    type: 'apiService',
    name: 'pet_api_service',
    fullyQualifiedName: 'pet_api_service',
    description: '',
    displayName: 'pet_api_service',
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
  sourceHash: '126fed48993b1373eee3566b33593361',
};
