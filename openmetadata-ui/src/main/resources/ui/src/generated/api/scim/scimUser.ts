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
/**
 * SCIM-compliant User object
 */
export interface ScimUser {
    active?:                                                       boolean;
    addresses?:                                                    Address[];
    displayName?:                                                  string;
    emails?:                                                       Email[];
    externalId?:                                                   string;
    id?:                                                           string;
    meta?:                                                         Meta;
    name?:                                                         Name;
    phoneNumbers?:                                                 PhoneNumber[];
    preferredLanguage?:                                            string;
    schemas?:                                                      string[];
    title?:                                                        string;
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User"?: UrnIETFParamsScimSchemasExtensionEnterprise20User;
    userName?:                                                     string;
    [property: string]: any;
}

export interface Address {
    country?:       string;
    formatted?:     string;
    locality?:      string;
    postalCode?:    string;
    region?:        string;
    streetAddress?: string;
    type?:          string;
    [property: string]: any;
}

export interface Email {
    primary?: boolean;
    type?:    string;
    value?:   string;
    [property: string]: any;
}

export interface Meta {
    created?:      Date;
    lastModified?: Date;
    location?:     string;
    resourceType?: string;
    [property: string]: any;
}

export interface Name {
    familyName?: string;
    formatted?:  string;
    givenName?:  string;
    [property: string]: any;
}

export interface PhoneNumber {
    type?:  string;
    value?: string;
    [property: string]: any;
}

export interface UrnIETFParamsScimSchemasExtensionEnterprise20User {
    department?: string;
    employeeId?: string;
    manager?:    Manager;
    [property: string]: any;
}

export interface Manager {
    displayName?: string;
    value?:       string;
    [property: string]: any;
}
