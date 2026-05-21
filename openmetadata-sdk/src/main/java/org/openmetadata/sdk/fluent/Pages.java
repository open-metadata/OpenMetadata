package org.openmetadata.sdk.fluent;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Pure Fluent API for Context Center Pages (articles and quick links).
 *
 * <pre>
 * import static org.openmetadata.sdk.fluent.Pages.*;
 *
 * Page article = create()
 *     .name("onboarding-guide")
 *     .withPageType(PageType.ARTICLE)
 *     .withDescription("How new hires get started")
 *     .execute();
 *
 * follow(article.getId().toString(), userId);
 * upvote(article.getId().toString());
 *
 * JsonNode tree = getHierarchy("Article");
 * </pre>
 */
public final class Pages {
  private static OpenMetadataClient defaultClient;

  private Pages() {}

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call Pages.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static PageCreator create() {
    return new PageCreator(getClient());
  }

  public static Page create(CreatePage request) {
    return getClient().pages().create(request);
  }

  // ==================== Direct access ====================

  public static Page get(String id) {
    return getClient().pages().get(id);
  }

  public static Page get(String id, String fields) {
    return getClient().pages().get(id, fields);
  }

  public static Page getByName(String fqn) {
    return getClient().pages().getByName(fqn);
  }

  public static Page getByName(String fqn, String fields) {
    return getClient().pages().getByName(fqn, fields);
  }

  public static Page update(String id, Page entity) {
    return getClient().pages().update(id, entity);
  }

  public static void delete(String id) {
    getClient().pages().delete(id);
  }

  public static void delete(String id, java.util.Map<String, String> params) {
    getClient().pages().delete(id, params);
  }

  public static Page restore(String id) {
    return getClient().pages().restore(id);
  }

  // ==================== Followers ====================

  public static ChangeEvent follow(String pageId, UUID userId) {
    return getClient().pages().addFollower(pageId, userId);
  }

  public static ChangeEvent unfollow(String pageId, UUID userId) {
    return getClient().pages().removeFollower(pageId, userId);
  }

  // ==================== Voting ====================

  public static ChangeEvent upvote(String pageId) {
    return vote(pageId, VoteRequest.VoteType.VOTED_UP);
  }

  public static ChangeEvent downvote(String pageId) {
    return vote(pageId, VoteRequest.VoteType.VOTED_DOWN);
  }

  public static ChangeEvent unvote(String pageId) {
    return vote(pageId, VoteRequest.VoteType.UN_VOTED);
  }

  public static ChangeEvent vote(String pageId, VoteRequest.VoteType type) {
    return getClient().pages().vote(pageId, new VoteRequest().withUpdatedVoteType(type));
  }

  // ==================== Hierarchy ====================

  public static JsonNode getHierarchy() {
    return getClient().pages().getHierarchy();
  }

  public static JsonNode getHierarchy(String pageType) {
    return getClient().pages().getHierarchy(pageType);
  }

  public static JsonNode searchHierarchy() {
    return getClient().pages().searchHierarchy(null, null, null, null, null);
  }

  public static JsonNode searchHierarchy(
      String parentFqn, String pageType, Integer offset, Integer limit, String activeFqn) {
    return getClient().pages().searchHierarchy(parentFqn, pageType, offset, limit, activeFqn);
  }

  // ==================== Finders ====================

  public static PageFinder find(String id) {
    return new PageFinder(getClient(), id, false);
  }

  public static PageFinder findByName(String fqn) {
    return new PageFinder(getClient(), fqn, true);
  }

  // ==================== Listing ====================

  public static ListResponse<Page> list() {
    return getClient().pages().list();
  }

  public static ListResponse<Page> list(ListParams params) {
    return getClient().pages().list(params);
  }

  // ==================== Builders ====================

  public static class PageCreator {
    private final OpenMetadataClient client;
    private final CreatePage request = new CreatePage();

    PageCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public PageCreator name(String name) {
      request.setName(name);
      return this;
    }

    public PageCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public PageCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public PageCreator withPageType(PageType pageType) {
      request.setPageType(pageType);
      return this;
    }

    public PageCreator withParent(EntityReference parent) {
      request.setParent(parent);
      return this;
    }

    public PageCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public PageCreator withReviewers(List<EntityReference> reviewers) {
      request.setReviewers(reviewers);
      return this;
    }

    public PageCreator withRelatedEntities(List<EntityReference> relatedEntities) {
      request.setRelatedEntities(relatedEntities);
      return this;
    }

    public Page execute() {
      return client.pages().create(request);
    }
  }

  public static class PageFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    PageFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }

    public PageFinder withFields(String... fields) {
      includes.addAll(Arrays.asList(fields));
      return this;
    }

    public Page fetch() {
      if (includes.isEmpty()) {
        return isFqn ? client.pages().getByName(identifier) : client.pages().get(identifier);
      }
      String fields = String.join(",", includes);
      return isFqn
          ? client.pages().getByName(identifier, fields)
          : client.pages().get(identifier, fields);
    }
  }
}
