package org.openmetadata.service.jdbi3;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.Entity.USER;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/** Builds a consolidated read plan for a single-entity fetch. */
final class ReadPlanner {

  record ReadPlannerConfig(
      String entityType,
      boolean supportsOwners,
      boolean supportsDomains,
      boolean supportsFollowers,
      boolean supportsReviewers,
      boolean supportsDataProducts,
      boolean supportsExperts,
      boolean supportsExtension,
      boolean supportsTags,
      boolean supportsVotes) {}

  ReadPlanBuilder newBuilder(
      EntityInterface entity,
      Fields fields,
      RelationIncludes relationIncludes,
      ReadPlannerConfig config) {
    if (entity == null
        || entity.getId() == null
        || fields == null
        || config == null
        || config.entityType() == null) {
      return new ReadPlanBuilder(null);
    }

    RelationIncludes includes =
        relationIncludes == null ? RelationIncludes.fromInclude(ALL) : relationIncludes;
    ReadPlanBuilder builder = new ReadPlanBuilder(entity.getId());

    if (fields.contains(FIELD_OWNERS) && config.supportsOwners()) {
      builder.addToRelationField(
          FIELD_OWNERS, includes.getIncludeFor(FIELD_OWNERS), Relationship.OWNS, null);
    }

    if (fields.contains(FIELD_FOLLOWERS) && config.supportsFollowers()) {
      builder.addToRelationField(
          FIELD_FOLLOWERS, includes.getIncludeFor(FIELD_FOLLOWERS), Relationship.FOLLOWS, USER);
    }

    if (fields.contains(FIELD_DOMAINS) && config.supportsDomains()) {
      builder.addToRelationField(
          FIELD_DOMAINS, includes.getIncludeFor(FIELD_DOMAINS), Relationship.HAS, DOMAIN);
    }

    if (fields.contains(FIELD_DATA_PRODUCTS) && config.supportsDataProducts()) {
      builder.addToRelationField(
          FIELD_DATA_PRODUCTS,
          includes.getIncludeFor(FIELD_DATA_PRODUCTS),
          Relationship.HAS,
          DATA_PRODUCT);
    }

    if (fields.contains(FIELD_REVIEWERS) && config.supportsReviewers()) {
      builder.addToRelationField(
          FIELD_REVIEWERS, includes.getIncludeFor(FIELD_REVIEWERS), Relationship.REVIEWS, null);
    }

    if (fields.contains(FIELD_CHILDREN)) {
      builder.addFromRelationField(
          FIELD_CHILDREN,
          includes.getIncludeFor(FIELD_CHILDREN),
          Relationship.CONTAINS,
          config.entityType());
    }

    if (fields.contains(FIELD_EXPERTS) && config.supportsExperts()) {
      builder.addFromRelationField(
          FIELD_EXPERTS, includes.getIncludeFor(FIELD_EXPERTS), Relationship.EXPERT, USER);
    }

    if (fields.contains(FIELD_EXTENSION) && config.supportsExtension()) {
      builder.requestExtension();
    }

    if (fields.contains(FIELD_TAGS) && config.supportsTags()) {
      builder.requestTags();
    }
    if (fields.contains(FIELD_VOTES) && config.supportsVotes()) {
      builder.requestVotes();
    }

    return builder;
  }

  ReadPlan build(
      EntityInterface entity,
      Fields fields,
      RelationIncludes relationIncludes,
      ReadPlannerConfig config) {
    return newBuilder(entity, fields, relationIncludes, config).build();
  }
}
