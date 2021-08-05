package org.openmetadata.catalog.events;

import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.entity.audit.AuditLog;
import org.openmetadata.catalog.jdbi3.AuditLogRepository;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityUtil;
import org.skife.jdbi.v2.DBI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.container.ContainerRequestContext;
import javax.ws.rs.container.ContainerResponseContext;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.TimeZone;
import java.util.UUID;

public class AuditEventHandler implements  EventHandler {
  private static final Logger LOG = LoggerFactory.getLogger(AuditEventHandler.class);
  private AuditLogRepository auditLogRepository;
  private final DateFormat df = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm'Z'"); // Quoted "Z" to indicate UTC,
  // no timezone offset


  public void init(CatalogApplicationConfig config, DBI jdbi) {
    this.auditLogRepository = jdbi.onDemand(AuditLogRepository.class);
    TimeZone tz = TimeZone.getTimeZone("UTC");
    this.df.setTimeZone(tz);
  }

  public Void process(ContainerRequestContext requestContext,
                      ContainerResponseContext responseContext) {
    int responseCode = responseContext.getStatus();
    String method = requestContext.getMethod();
    LOG.info("are we processing, harsha");
    if (responseContext.getEntity() != null) {
      String path = requestContext.getUriInfo().getPath();
      String username = requestContext.getSecurityContext().getUserPrincipal().getName();
      String nowAsISO = df.format(new Date());

      try {
        EntityReference entityReference = EntityUtil.getEntityReference(responseContext.getEntity(),
                responseContext.getEntity().getClass());
        if (entityReference != null) {
          AuditLog auditLog = new AuditLog().withId(UUID.randomUUID())
                  .withPath(path)
                  .withDate(nowAsISO)
                  .withEntityId(entityReference.getId())
                  .withEntityType(entityReference.getType())
                  .withEntity(entityReference)
                  .withMethod(method)
                  .withUsername(username)
                  .withResponseCode(responseCode);
          auditLogRepository.create(auditLog);
          LOG.debug("Added audit log entry: {}", auditLog);
        } else {
          LOG.error("Failed to capture audit log for {}", path);
        }
      } catch(Exception e) {
        LOG.error("Failed to capture audit log due to {}", e.getMessage());
      }
    }
    return null;
  }

  public void close() {}

}
