package org.openmetadata.service.resources.openlineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.jdbi3.OpenLineageEventRepository;
import org.openmetadata.service.security.Authorizer;


import javax.ws.rs.core.Response;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

public class OpenLineageEventsResourceTest {

    @Mock
    private OpenLineageEventRepository dao;

    @Mock
    private Authorizer authorizer;

    @InjectMocks
    private OpenLineageEventsResource resource;

    @BeforeEach
    void setUp() throws Exception {
        MockitoAnnotations.openMocks(this);
        resource = new OpenLineageEventsResource(authorizer);

        // Use reflection to set the private dao field
        Field daoField = OpenLineageEventsResource.class.getDeclaredField("dao");
        daoField.setAccessible(true);
        daoField.set(resource, dao);
    }

    @Test
    void testCreateEvent() {
        String eventJson = "{\"run\": {\"runId\": \"123\"}, \"eventType\": \"start\"}";

        Response response = resource.createEvent(null, eventJson);

        assertEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
        verify(dao, times(1)).create(any());
    }

    @Test
    void testCreateEventWithInvalidData() {
        String eventJson = "{\"run\": {}, \"eventType\": \"\"}";

        try {
            resource.createEvent(null, eventJson);
        } catch (CustomExceptionMessage e) {
            assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), e.getResponse().getStatus());
        }

        verify(dao, times(0)).create(any());
    }

    @Test
    void testListEvents() {
        List<String> mockEvents = new ArrayList<>();
        mockEvents.add("{\"run\": {\"runId\": \"123\"}, \"eventType\": \"start\"}");
        mockEvents.add("{\"run\": {\"runId\": \"124\"}, \"eventType\": \"complete\"}");

        when(dao.listAllEvents()).thenReturn(mockEvents);



        Response response = resource.listEvents();

        assertEquals(Response.Status.OK.getStatusCode(), response.getStatus());
        ArrayList<String> events = (ArrayList<String>) response.getEntity();

        assertEquals(2, events.size());
        assertEquals("{\"run\": {\"runId\": \"123\"}, \"eventType\": \"start\"}", events.get(0));
        assertEquals("{\"run\": {\"runId\": \"124\"}, \"eventType\": \"complete\"}", events.get(1));
    }

    @Test
    void testValidateEmptyEvent() {
        String eventJson = "";

        try {
            resource.createEvent(null, eventJson);
        } catch (CustomExceptionMessage e) {
            assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), e.getResponse().getStatus());
            assertEquals("OpenLineageEvent body cannot be empty.", e.getMessage());
        }

        verify(dao, times(0)).create(any());
    }

    @Test
    void testValidateEventWithoutRunId() {
        String eventJson = "{\"run\": {}, \"eventType\": \"start\"}";

        try {
            resource.createEvent(null, eventJson);
        } catch (CustomExceptionMessage e) {
            assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), e.getResponse().getStatus());
            assertEquals("OpenLineageEvent RunID cannot be empty.", e.getMessage());
        }

        verify(dao, times(0)).create(any());
    }

    @Test
    void testValidateEventWithoutEventType() {
        String eventJson = "{\"run\": {\"runId\": \"123\"}, \"eventType\": \"\"}";

        try {
            resource.createEvent(null, eventJson);
        } catch (CustomExceptionMessage e) {
            assertEquals(Response.Status.BAD_REQUEST.getStatusCode(), e.getResponse().getStatus());
            assertEquals("OpenLineageEvent EventType cannot be empty.", e.getMessage());
        }

        verify(dao, times(0)).create(any());
    }
}
