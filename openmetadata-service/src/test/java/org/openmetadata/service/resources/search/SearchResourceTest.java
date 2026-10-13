package org.openmetadata.service.resources.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.core.SecurityContext;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.search.PreviewSearchRequest;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;

class SearchResourceTest {

  @ParameterizedTest
  @CsvSource({"-25, 25, from", "0, -1, size", ", -1, size"})
  void previewSearchRejectsNegativePaginationWithoutSearching(
      Integer from, Integer size, String rejectedField) {
    SearchRepository searchRepository = mock(SearchRepository.class);
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      SearchResource resource = new SearchResource(mock(Authorizer.class));
      PreviewSearchRequest request =
          new PreviewSearchRequest()
              .withQuery("*")
              .withIndex("table")
              .withFrom(from)
              .withSize(size);

      BadRequestException error =
          assertThrows(
              BadRequestException.class,
              () -> resource.previewSearch(mock(SecurityContext.class), request));

      assertEquals(rejectedField + " must be greater than or equal to 0", error.getMessage());
      verifyNoInteractions(searchRepository);
    }
  }
}
