package org.openmetada.restclient.auth;

import org.openmetada.restclient.ApiClient;
import feign.Headers;
import feign.Param;
import feign.RequestLine;
import org.openmetadata.core.entity.interfaces.CreateEntity;

import javax.ws.rs.core.Response;

public interface OpenMetaDataApi extends ApiClient.Api {

    /**
     * Create a Entity
     * @param body  (optional)
     * @return Bots
     */
    @RequestLine("POST /{entityType}")
    @Headers({
            "Content-Type: application/json",
            "Accept: application/json",
    })
    Response create(@Param("entityType") String entityType, CreateEntity body);

    /**
     * Create a entity if doesn't exist or update
     * @param body  (optional)
     * @return Bots
     */
    @RequestLine("PUT /{entityType}")
    @Headers({
            "Content-Type: application/json",
            "Accept: application/json",
    })
    Response createOrUpdate(@Param("entityType") String entityType, CreateEntity body);

    /**
     * Update a Entity
     * @return Bots
     */
    @RequestLine("PATCH /{entityType}/{id}")
    @Headers({
            "Content-Type: application/json-patch+json",
            "Accept: application/json",
    })
    Response patch(@Param("entityType") String entityType, @Param("id") String id);

    /**
     * Delete a Entity
     * @return Bots
     */
    @RequestLine("DELETE /{entityType}/{id}")
    @Headers({
            "Content-Type: application/jsons",
            "Accept: application/json",
    })
    Response delete(@Param("entityType") String entityType, @Param("id") String id);

    /**
     * Get Entity By Name
     * @return Object

     */
    @RequestLine("GET /{entityType}/name/{fqn}")
    @Headers({
            "Content-Type: */*",
            "Accept: application/json",
    })
    Object getEntityByFQN(@Param("entityType") String entityType, @Param("fqn") String id);

    /**
     * Get a Entity
     * Get a Entity by &#x60;id&#x60;.
     * @param id  (required)
     * @return Bots
     */
    @RequestLine("GET /{entityType}/{id}")
    @Headers({
            "Accept: application/json",
    })
    Object getEntityByID(@Param("entityType") String entityType, @Param("id") String id);

    /**
     * List Entitities of entity type
     * Get a list of bots.
     * @return BotsList
     */
    @RequestLine("GET /{entity}")
    @Headers({
            "Accept: application/json",
    })
    Object getEntityList(@Param("limit") Integer limit, @Param("before") String before, @Param("after") String after);

}
