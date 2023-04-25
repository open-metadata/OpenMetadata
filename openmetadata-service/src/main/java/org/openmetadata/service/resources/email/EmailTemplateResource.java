package org.openmetadata.service.resources.email;

import freemarker.template.TemplateException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.validation.Valid;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.SecurityContext;
import javax.ws.rs.core.UriInfo;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.auth.EmailTemplate;
import org.openmetadata.schema.email.EmailTemplateConfig;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EmailTemplateRepository;
import org.openmetadata.service.resources.Collection;
import org.openmetadata.service.resources.settings.SettingsCache;

@Slf4j
@Path("/v1/emails")
@Tag(name = "Emails", description = "Email Templates")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@Collection(name = "emails")
public class EmailTemplateResource {

  private static EmailTemplateRepository emailTemplateRepository;
  private static SmtpSettings emailConfig;

  public static void initialize(CollectionDAO dao) throws IOException {
    emailTemplateRepository = new EmailTemplateRepository(dao);
    emailConfig = SettingsCache.getInstance().getSetting(SettingsType.EMAIL_CONFIGURATION, SmtpSettings.class);
    if (emailConfig.getEmailTemplate() != null) {
      if (!(dao.emailTemplateDAO().getEmailTypes().size() == 8)) {
        populateTemplateInDb();
      } else LOG.info("templates are already present");
    }
  }

  private static void populateTemplateInDb() {
    EmailTemplateConfig emailTemplateConfig = emailConfig.getEmailTemplate();
    String basePath = emailTemplateConfig.getEmailTemplateBasePath();
    List<String> fileNames =
        new ArrayList<>(
            List.of(
                emailTemplateConfig.getEmailVerificationTemplate(),
                emailTemplateConfig.getPasswordResetTemplate(),
                emailTemplateConfig.getAccountStatusTemplate(),
                emailTemplateConfig.getInviteRandomPasswordTemplate(),
                emailTemplateConfig.getChangeEventTemplate(),
                emailTemplateConfig.getInviteCreatePasswordTemplate(),
                emailTemplateConfig.getTaskNotificationTemplate(),
                emailTemplateConfig.getTestNotificationTemplate()));
    emailTemplateRepository.populateTemplateInDb(fileNames, basePath);
  }

  @GET
  @Path("/{emailType}")
  @Operation(
      operationId = "getEmailTemplateByEmailType",
      summary = "Get an email template by emailType",
      description = "Get an email template by `emailType`",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "email",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EmailTemplate.class))),
        @ApiResponse(responseCode = "404", description = "EmailTemplate for instance {emailType} is not found")
      })
  public EmailTemplate get(
      @Context UriInfo uriInfo,
      @Context SecurityContext securityContext,
      @Parameter(description = "email template type", schema = @Schema(type = "string")) @PathParam("emailType")
          String emailType)
      throws IOException {
    return EmailTemplateRepository.getEmailTemplate(emailType);
  }

  @PUT
  @Operation(
      operationId = "createOrUpdateEmailTemplate",
      summary = "Create or update an email template",
      description =
          "Create an email template, if it does not exist. If an email template already exists, update the email template.",
      responses = {
        @ApiResponse(
            responseCode = "200",
            description = "The email template",
            content = @Content(mediaType = "application/json", schema = @Schema(implementation = EmailTemplate.class))),
        @ApiResponse(responseCode = "400", description = "Bad request")
      })
  public Response createOrUpdate(
      @Context UriInfo uriInfo, @Context SecurityContext securityContext, @Valid EmailTemplate EmailTemplate)
      throws IOException, TemplateException {
    emailTemplateRepository.insertOrUpdateEmailTemplate(EmailTemplate.getEmailType(), EmailTemplate.getEmailContent());
    return Response.accepted().entity(EmailTemplate).build();
  }
}
