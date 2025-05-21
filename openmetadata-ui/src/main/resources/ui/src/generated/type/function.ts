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
 * Functions used for writing SpEL expression based conditions
 */
export interface Function {
    /**
     * Description for the function.
     */
    description?: string;
    /**
     * Examples of the function to help users author conditions.
     */
    examples?: any[];
    /**
     * Description of input taken by the function.
     */
    input?: string;
    /**
     * Name of the function.
     */
    name?:                   string;
    paramAdditionalContext?: ParamAdditionalContext;
    /**
     * List of receivers to send mail to
     */
    parameterInputType?: ParameterType;
}

/**
 * Additional Context
 */
export interface ParamAdditionalContext {
    /**
     * List of Entities
     */
    data?: any;
}

/**
 * List of receivers to send mail to
 */
export enum ParameterType {
    AllIndexElasticSearch = "AllIndexElasticSearch",
    NotRequired = "NotRequired",
    ReadFromParamContext = "ReadFromParamContext",
    ReadFromParamContextPerEntity = "ReadFromParamContextPerEntity",
    SpecificIndexElasticSearch = "SpecificIndexElasticSearch",
}
