package org.openmetadata.service.search.indexes;

/**
 * Combined marker interface for service-backed data assets with tags and lineage. This is the most
 * common pattern, used by Table, Topic, Dashboard, Pipeline, MlModel, Container, StoredProcedure,
 * SearchEntity, APIEndpoint, DashboardDataModel, Worksheet, File, Spreadsheet, Directory, and
 * others.
 *
 * <p>All fields (common, tags, service, lineage) are populated automatically by {@link
 * SearchIndex#buildSearchIndexDoc()}. Implementations only need to add entity-specific fields in
 * {@link SearchIndex#buildSearchIndexDocInternal(java.util.Map)}.
 *
 * <p>For entities with child tags (columns, schema fields), call {@link
 * TaggableIndex#mergeChildTags(java.util.Map, java.util.Set)} from {@code
 * buildSearchIndexDocInternal}.
 */
public interface DataAssetIndex extends TaggableIndex, ServiceBackedIndex, LineageIndex {}
