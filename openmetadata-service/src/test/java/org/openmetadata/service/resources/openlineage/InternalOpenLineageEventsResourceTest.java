package org.openmetadata.service.resources.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.lineage.OpenLineageWrappedEvent;
import org.openmetadata.service.jdbi3.OpenLineageEventRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.util.ResultList;

@ExtendWith(MockitoExtension.class)
public class InternalOpenLineageEventsResourceTest {

  @Mock private OpenLineageEventRepository dao;

  @Mock private Authorizer authorizer;

  @InjectMocks private InternalOpenLineageEventsResource resource;

  @BeforeEach
  void setUp() throws Exception {
    resource = new InternalOpenLineageEventsResource(authorizer);
    Field daoField = InternalOpenLineageEventsResource.class.getDeclaredField("dao");
    daoField.setAccessible(true);
    daoField.set(resource, dao);
  }

  @Test
  public void testUpdateEvent_MarkAsProcessed() {
    UUID id = UUID.randomUUID();

    Response response = resource.updateEvent(id);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    Mockito.verify(dao, Mockito.times(1)).markAsProcessed(id);
  }

  @Test
  public void testGetEvents_AllParams() {
    String runId = "runId1";
    String eventType = "START";
    Boolean unprocessed = true;
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();

    when(dao.queryEvents(eq(runId), eq(eventType), eq(unprocessed))).thenReturn(mockResultList);

    ResultList<OpenLineageWrappedEvent> result =
        resource.queryEvents(uriInfo, runId, eventType, unprocessed);

    assertEquals(mockResultList, result);
  }

  @Test
  public void testGetEvents_NoParams() {
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();

    when(dao.queryEvents(isNull(), isNull(), isNull())).thenReturn(mockResultList);

    ResultList<OpenLineageWrappedEvent> result = resource.queryEvents(uriInfo, null, null, null);

    assertEquals(mockResultList, result);
  }

  @Test
  public void testGetEvents_RunIdOnly() {
    String runId = "runId1";
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();

    when(dao.queryEvents(eq(runId), isNull(), isNull())).thenReturn(mockResultList);

    ResultList<OpenLineageWrappedEvent> result = resource.queryEvents(uriInfo, runId, null, null);

    assertEquals(mockResultList, result);
  }

  @Test
  public void testGetEvents_EventTypeOnly() {
    String eventType = "START";
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();

    when(dao.queryEvents(isNull(), eq(eventType), isNull())).thenReturn(mockResultList);

    ResultList<OpenLineageWrappedEvent> result =
        resource.queryEvents(uriInfo, null, eventType, null);

    assertEquals(mockResultList, result);
  }

  @Test
  public void testGetEvents_UnprocessedOnly() {
    Boolean unprocessed = true;
    UriInfo uriInfo = Mockito.mock(UriInfo.class);
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();

    when(dao.queryEvents(isNull(), isNull(), eq(unprocessed))).thenReturn(mockResultList);

    ResultList<OpenLineageWrappedEvent> result =
        resource.queryEvents(uriInfo, null, null, unprocessed);

    assertEquals(mockResultList, result);
  }

  @Test
  public void testDeleteLineageEvent_Success() {
    UUID id = UUID.randomUUID();
    OpenLineageWrappedEvent mockEvent = new OpenLineageWrappedEvent();
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();
    mockResultList.setData(List.of(mockEvent));

    when(dao.queryEvents(anyString(), eq(null), eq(null))).thenReturn(mockResultList);

    Response response = resource.deleteLineageEvent(id);

    assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
    Mockito.verify(dao, Mockito.times(1)).deleteLineageEvent(mockEvent);
  }

  @Test
  public void testDeleteLineageEvent_NotFound() {
    UUID id = UUID.randomUUID();
    ResultList<OpenLineageWrappedEvent> mockResultList = new ResultList<>();
    mockResultList.setData(new ArrayList());

    when(dao.queryEvents(anyString(), eq(null), eq(null))).thenReturn(mockResultList);

    Response response = resource.deleteLineageEvent(id);

    assertEquals(Response.Status.NOT_FOUND.getStatusCode(), response.getStatus());
    Mockito.verify(dao, Mockito.never()).deleteLineageEvent(any(OpenLineageWrappedEvent.class));
  }
}
