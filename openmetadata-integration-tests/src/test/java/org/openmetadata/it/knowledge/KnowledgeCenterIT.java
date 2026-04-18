package org.openmetadata.it.knowledge;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.domains.DataProductService;
import org.openmetadata.sdk.services.domains.DomainService;
import org.openmetadata.sdk.services.teams.TeamService;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.sdk.test.util.SdkClients;
import org.openmetadata.sdk.test.util.TestNamespace;
import org.openmetadata.sdk.test.util.TestNamespaceExtension;

@ExtendWith(TestNamespaceExtension.class)
public class KnowledgeCenterIT {

  private static final String KC_PATH = "v1/knowledgeCenter";

  private Page createPage(RestClient rest, CreatePage request) throws HttpResponseException {
    return rest.create(KC_PATH, request, Page.class);
  }

  private Page getPage(RestClient rest, UUID id, String fields)
      throws HttpResponseException {
    return rest.getById(KC_PATH, id, fields, Page.class);
  }

  private Page patchPage(RestClient rest, UUID id, String originalJson, Page updated)
      throws HttpResponseException {
    return rest.patch(KC_PATH, id, originalJson, updated, Page.class);
  }

  private CreatePage buildCreateRequest(String name, EntityReference relatedEntity) {
    return new CreatePage()
        .withName(name)
        .withPageType(PageType.ARTICLE)
        .withDescription("This is a test Description.")
        .withPage(new Article())
        .withRelatedEntities(List.of(relatedEntity));
  }

  private EntityReference getOrganizationRef() {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    TeamService teamService = new TeamService(adminClient.getHttpClient());
    Team org = teamService.getByName("Organization", null);
    return org.getEntityReference();
  }

  @Test
  void testRelatedEntitiesExcludesDomainsAndDataProducts(TestNamespace ns)
      throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DomainService domainSvc = new DomainService(adminClient.getHttpClient());

    EntityReference orgRef = getOrganizationRef();
    CreatePage createPageReq = buildCreateRequest(ns.prefix("pageExcludesDomains"), orgRef);
    Page page = createPage(rest, createPageReq);

    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix("testDomain"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain");
    Domain domain = domainSvc.create(createDomain);

    String original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    Page fetchedPage = getPage(rest, page.getId(), "relatedEntities,domains,dataProducts");

    assertEquals(1, fetchedPage.getDomains().size());
    assertEquals(domain.getName(), fetchedPage.getDomains().get(0).getName());

    boolean domainInRelatedEntities =
        fetchedPage.getRelatedEntities().stream().anyMatch(ref -> "domain".equals(ref.getType()));
    assertEquals(false, domainInRelatedEntities, "Domains should not appear in relatedEntities");

    boolean dataProductInRelatedEntities =
        fetchedPage.getRelatedEntities().stream()
            .anyMatch(ref -> "dataProduct".equals(ref.getType()));
    assertEquals(
        false, dataProductInRelatedEntities, "DataProducts should not appear in relatedEntities");
  }

  @Test
  void testDomainAddUpdateRemove(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DomainService domainSvc = new DomainService(adminClient.getHttpClient());

    EntityReference orgRef = getOrganizationRef();
    CreatePage createPageReq = buildCreateRequest(ns.prefix("pageDomainCrud"), orgRef);
    Page page = createPage(rest, createPageReq);

    CreateDomain createDomain1 =
        new CreateDomain()
            .withName(ns.prefix("testDomain1"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain 1");
    Domain domain1 = domainSvc.create(createDomain1);

    CreateDomain createDomain2 =
        new CreateDomain()
            .withName(ns.prefix("testDomain2"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain 2");
    Domain domain2 = domainSvc.create(createDomain2);

    String original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain1.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    Page fetchedPage = getPage(rest, page.getId(), "domains,relatedEntities");
    assertEquals(1, fetchedPage.getDomains().size());
    assertEquals(domain1.getName(), fetchedPage.getDomains().get(0).getName());

    original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain2.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "domains,relatedEntities");
    assertEquals(1, fetchedPage.getDomains().size());
    assertEquals(domain2.getName(), fetchedPage.getDomains().get(0).getName());

    boolean domain1InDomains =
        fetchedPage.getDomains().stream().anyMatch(ref -> domain1.getName().equals(ref.getName()));
    assertEquals(false, domain1InDomains, "Old domain should be removed after update");

    original = JsonUtils.pojoToJson(page);
    page.withDomains(null);
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "domains,relatedEntities");
    int domainCount = fetchedPage.getDomains() == null ? 0 : fetchedPage.getDomains().size();
    assertEquals(0, domainCount, "Domain should be removed");

    boolean anyDomainInRelatedEntities =
        fetchedPage.getRelatedEntities().stream().anyMatch(ref -> "domain".equals(ref.getType()));
    assertEquals(
        false, anyDomainInRelatedEntities, "No domains should ever appear in relatedEntities");
  }

  @Test
  void testDataProductAddUpdateRemove(TestNamespace ns) throws HttpResponseException {
    RestClient rest = RestClient.admin();
    OpenMetadataClient adminClient = SdkClients.adminClient();
    DomainService domainSvc = new DomainService(adminClient.getHttpClient());
    DataProductService dpSvc = new DataProductService(adminClient.getHttpClient());

    EntityReference orgRef = getOrganizationRef();
    CreatePage createPageReq = buildCreateRequest(ns.prefix("pageDpCrud"), orgRef);
    Page page = createPage(rest, createPageReq);

    CreateDomain createDomain =
        new CreateDomain()
            .withName(ns.prefix("testDomainDP"))
            .withDomainType(CreateDomain.DomainType.AGGREGATE)
            .withDescription("Test domain for data products");
    Domain domain = domainSvc.create(createDomain);

    String original = JsonUtils.pojoToJson(page);
    page.withDomains(List.of(domain.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    page = getPage(rest, page.getId(), "domains,relatedEntities");

    CreateDataProduct createDataProduct1 =
        new CreateDataProduct()
            .withName(ns.prefix("testDP1"))
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withDescription("Test data product 1");
    DataProduct dataProduct1 = dpSvc.create(createDataProduct1);

    CreateDataProduct createDataProduct2 =
        new CreateDataProduct()
            .withName(ns.prefix("testDP2"))
            .withDomains(List.of(domain.getFullyQualifiedName()))
            .withDescription("Test data product 2");
    DataProduct dataProduct2 = dpSvc.create(createDataProduct2);

    original = JsonUtils.pojoToJson(page);
    page.withDataProducts(List.of(dataProduct1.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    Page fetchedPage = getPage(rest, page.getId(), "dataProducts,relatedEntities,domains");
    assertEquals(1, fetchedPage.getDataProducts().size());
    assertEquals(dataProduct1.getName(), fetchedPage.getDataProducts().get(0).getName());

    original = JsonUtils.pojoToJson(page);
    page.withDataProducts(List.of(dataProduct2.getEntityReference()));
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "dataProducts,relatedEntities,domains");
    assertEquals(1, fetchedPage.getDataProducts().size());
    assertEquals(dataProduct2.getName(), fetchedPage.getDataProducts().get(0).getName());

    boolean dataProduct1InDataProducts =
        fetchedPage.getDataProducts().stream()
            .anyMatch(ref -> dataProduct1.getName().equals(ref.getName()));
    assertEquals(
        false, dataProduct1InDataProducts, "Old dataProduct should be removed after update");

    original = JsonUtils.pojoToJson(page);
    page.withDataProducts(null);
    page = patchPage(rest, page.getId(), original, page);

    fetchedPage = getPage(rest, page.getId(), "dataProducts,relatedEntities,domains");
    int dataProductCount =
        fetchedPage.getDataProducts() == null ? 0 : fetchedPage.getDataProducts().size();
    assertEquals(0, dataProductCount, "DataProduct should be removed");

    boolean anyDataProductInRelatedEntities =
        fetchedPage.getRelatedEntities().stream()
            .anyMatch(ref -> "dataProduct".equals(ref.getType()));
    assertEquals(
        false,
        anyDataProductInRelatedEntities,
        "No dataProducts should ever appear in relatedEntities");
  }
}
