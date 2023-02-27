/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets.converter.service;

import org.openmetadata.service.util.JsonUtils;

/**
 * Currently when an object is converted into a specific class using `JsonUtils.convertValue` there`Object` fields that
 * are not converted into any concrete class which could lead to assign a `LinkedMap` to the `Object` field.
 *
 * <p>This abstract class wrap these `JsonUtils.convertValue` adding transformation to those `Object` fields into
 * specific classes.
 */
public abstract class ConnectionConverter {

  protected Class<?> serviceClass;

  public ConnectionConverter(Class<?> serviceClass) {
    this.serviceClass = serviceClass;
  }

  public Object convertFromJson(Object connectionConfig) {
    return JsonUtils.convertValue(connectionConfig, this.serviceClass);
  }
}
