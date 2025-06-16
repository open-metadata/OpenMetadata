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
 * Definition of a tool available in the Model Context Protocol
 */
export interface MCPToolDefinition {
    /**
     * Description of what the tool does
     */
    description: string;
    /**
     * Name of the tool
     */
    name: string;
    /**
     * Definition of tool parameters
     */
    parameters: ToolParameters;
    [property: string]: any;
}

/**
 * Definition of tool parameters
 *
 * Tool parameter definitions
 */
export interface ToolParameters {
    /**
     * Parameter properties
     */
    properties: { [key: string]: ToolParameter };
    /**
     * List of required parameters
     */
    required?: string[];
    /**
     * Type of parameter schema
     */
    type?: string;
    [property: string]: any;
}

/**
 * Individual tool parameter definition
 */
export interface ToolParameter {
    /**
     * Default value for this parameter
     */
    default?: any;
    /**
     * Description of the parameter
     */
    description: string;
    /**
     * Possible enum values for this parameter
     */
    enum?: any[];
    /**
     * Type of parameter
     */
    type: Type;
    [property: string]: any;
}

/**
 * Type of parameter
 */
export enum Type {
    Array = "array",
    Boolean = "boolean",
    Integer = "integer",
    Number = "number",
    Object = "object",
    String = "string",
}
