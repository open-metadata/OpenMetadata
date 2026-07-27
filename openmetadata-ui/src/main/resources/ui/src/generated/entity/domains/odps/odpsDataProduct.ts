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
/**
 * Open Data Product Standard (ODPS) v4.1 data product representation for import/export. See
 * https://opendataproducts.org/v4.1/.
 */
export interface OdpsDataProduct {
    /**
     * Product metadata container (required per ODPS).
     */
    product: OdpsProduct;
    /**
     * URL of the ODPS schema (required per ODPS).
     */
    schema?: string;
    /**
     * ODPS specification version (required per ODPS).
     */
    version: OdpsAPIVersion;
    [property: string]: any;
}

/**
 * Product metadata container (required per ODPS).
 *
 * Root product container per ODPS v4.1.
 */
export interface OdpsProduct {
    contract?:    OdpsContract;
    dataAccess?:  OdpsDataAccess;
    dataHolder?:  OdpsDataHolder;
    dataQuality?: OdpsDataQuality;
    /**
     * Language-keyed product details (ISO 639-1 keys like 'en', 'fr', 'de').
     */
    details:          { [key: string]: OdpsProductDetails };
    license?:         OdpsLicense;
    productStrategy?: OdpsProductStrategy;
    SLA?:             OdpsSLA;
    [property: string]: any;
}

/**
 * Service Level Agreement per ODPS v4.1.
 */
export interface OdpsSLA {
    /**
     * Human-readable SLA declarations.
     */
    declarative?: OdpsSLADimension[];
    [property: string]: any;
}

/**
 * One SLA dimension with its target value and unit.
 */
export interface OdpsSLADimension {
    /**
     * Dimension name (uptime, responseTime, latency, errorRate, endOfSupport, endOfLife,
     * updateFrequency, timeToDetect, timeToNotify, timeToRepair, emailResponseTime).
     */
    dimension?:    string;
    displayTitle?: string;
    /**
     * Target value for the dimension.
     */
    objective?: number;
    /**
     * Unit of measurement (%, ms, seconds, minutes, hours, days, etc.).
     */
    unit?: string;
    [property: string]: any;
}

/**
 * Reference to a data contract (e.g., ODCS or DCS).
 */
export interface OdpsContract {
    /**
     * Inline contract object (opaque pass-through for round-trip).
     */
    contract?: { [key: string]: any };
    /**
     * Contract standard (odcs, dcs, custom).
     */
    type?: string;
    /**
     * URL or FQN pointing to the contract definition.
     */
    url?:     string;
    version?: string;
    [property: string]: any;
}

/**
 * All data access methods offered by this product.
 */
export interface OdpsDataAccess {
    methods?: OdpsDataAccessMethod[];
    [property: string]: any;
}

/**
 * One method by which consumers can access the data product.
 */
export interface OdpsDataAccessMethod {
    /**
     * Authentication method (apiKey, oauth2, basic, none, etc.).
     */
    authentication?:   string;
    description?:      string;
    displayTitle?:     string;
    documentationURL?: string;
    /**
     * Data format (JSON, CSV, PARQUET, AVRO, etc.).
     */
    format?: string;
    /**
     * Access method specification (e.g., OpenAPI URL, JDBC connection string).
     */
    specification?: string;
    /**
     * Access method type (api, file, sql, mcp, ai, s3, kafka, etc.).
     */
    type?: string;
    [property: string]: any;
}

/**
 * Organization legally authorized to publish the product.
 */
export interface OdpsDataHolder {
    businessDomain?: string;
    contactEmail?:   string;
    contactURL?:     string;
    description?:    string;
    legalName?:      string;
    [property: string]: any;
}

/**
 * Data quality targets per ODPS v4.1.
 */
export interface OdpsDataQuality {
    declarative?: OdpsDataQualityDimension[];
    [property: string]: any;
}

/**
 * One data quality dimension with its target value.
 */
export interface OdpsDataQualityDimension {
    /**
     * Quality dimension (accuracy, completeness, conformity, consistency, coverage, timeliness,
     * uniqueness, validity).
     */
    dimension?:    string;
    displayTitle?: string;
    objective?:    number;
    unit?:         string;
    [property: string]: any;
}

/**
 * Language-specific product details per ODPS v4.1.
 */
export interface OdpsProductDetails {
    /**
     * Comma-separated topic classifications.
     */
    categories?: string[];
    /**
     * ISO 8601 creation timestamp.
     */
    created?: Date;
    /**
     * Human-readable product overview.
     */
    description?:       string;
    governanceProfile?: OdpsGovernanceProfile;
    /**
     * Optional logo URL for the product.
     */
    logoURL?: string;
    /**
     * The name of the product (required per ODPS).
     */
    name?:              string;
    portfolioPriority?: OdpsPortfolioPriority;
    /**
     * Product identifier (required per ODPS).
     */
    productID?: string;
    /**
     * Semantic version per SemVer standard.
     */
    productVersion?: string;
    /**
     * Related standards (e.g., ISO 8000, ISO 19131).
     */
    standards?: string[];
    status?:    OdpsStatus;
    /**
     * Search and discovery keywords.
     */
    tags?: string[];
    type?: OdpsType;
    /**
     * ISO 8601 last-modified timestamp.
     */
    updated?: Date;
    /**
     * Product's value proposition — crystallizes the value for the customer.
     */
    valueProposition?: string;
    visibility?:       OdpsVisibility;
    [property: string]: any;
}

/**
 * Governance maturity level of the data product per ODPS v4.1.
 */
export enum OdpsGovernanceProfile {
    AuditReady = "audit_ready",
    Automated = "automated",
    Enforced = "enforced",
    Structured = "structured",
}

/**
 * Portfolio-level priority of the data product.
 */
export enum OdpsPortfolioPriority {
    Critical = "critical",
    High = "high",
    Low = "low",
    Medium = "medium",
}

/**
 * Lifecycle status of the data product per ODPS v4.1.
 */
export enum OdpsStatus {
    Acceptance = "acceptance",
    Announcement = "announcement",
    Development = "development",
    Draft = "draft",
    Production = "production",
    Retired = "retired",
    Sunset = "sunset",
    Testing = "testing",
}

/**
 * Type of the data product per ODPS v4.1 taxonomy.
 */
export enum OdpsType {
    Algorithm = "algorithm",
    AnalyticView = "analytic view",
    AutomatedDecisionMaking = "automated decision-making",
    BIDirectional = "bi-directional",
    DataDrivenService = "data-driven service",
    DataEnabledPerformance = "data-enabled performance",
    DataEnhancedProduct = "data-enhanced product",
    Dataset = "dataset",
    DecisionSupport = "decision support",
    DerivedData = "derived data",
    RawData = "raw data",
    Reports = "reports",
    The3DVisualisation = "3D visualisation",
}

/**
 * Visibility level of the data product per ODPS v4.1.
 */
export enum OdpsVisibility {
    Dataspace = "dataspace",
    Invitation = "invitation",
    Organisation = "organisation",
    Private = "private",
    Public = "public",
}

/**
 * Licensing terms and governance conditions.
 */
export interface OdpsLicense {
    description?: string;
    type?:        string;
    url?:         string;
    [property: string]: any;
}

/**
 * Business strategy alignment for the data product.
 */
export interface OdpsProductStrategy {
    KPIs?:       { [key: string]: any }[];
    objectives?: string[];
    [property: string]: any;
}

/**
 * ODPS specification version (required per ODPS).
 *
 * ODPS specification version.
 */
export enum OdpsAPIVersion {
    The40 = "4.0",
    The41 = "4.1",
}
