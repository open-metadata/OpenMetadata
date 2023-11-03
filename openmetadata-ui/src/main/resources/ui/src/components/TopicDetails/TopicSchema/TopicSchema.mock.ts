/*
 *  Copyright 2022 Collate.
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

import { DataTypeTopic, Field } from '../../../generated/entity/data/topic';

export const nestedField: Field = {
  name: 'Order',
  displayName: 'Order',
  dataType: DataTypeTopic.Record,
  description: 'All the order events on our online store',
  children: [
    {
      name: 'order_id',
      dataType: DataTypeTopic.Int,
      description: 'order_id',
    },
    {
      name: 'api_client_id',
      dataType: DataTypeTopic.Int,
      description: 'api_client_id',
    },
    {
      name: 'billing_address_id',
      dataType: DataTypeTopic.Int,
    },
    {
      name: 'customer_id',
      dataType: DataTypeTopic.Int,
    },
    {
      name: 'location_id',
      dataType: DataTypeTopic.Int,
    },
    {
      name: 'shipping_address_id',
      dataType: DataTypeTopic.Int,
    },
    {
      name: 'user_id',
      dataType: DataTypeTopic.Int,
    },
    {
      name: 'total_price',
      dataType: DataTypeTopic.Double,
    },
    {
      name: 'discount_code',
      dataType: DataTypeTopic.String,
    },
    {
      name: 'processed_at',
      dataType: DataTypeTopic.Int,
    },
  ],
};
