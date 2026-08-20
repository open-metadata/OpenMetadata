package org.openmetadata.service.security;

import jakarta.servlet.ServletContext;
import org.openmetadata.service.security.session.SessionService;

public class AuthServeletHandlerRegistry {
  public static final String AUTH_HANDLER_ATTRIBUTE =
      AuthServeletHandlerRegistry.class.getName() + ".authHandler";
  public static final String SESSION_SERVICE_ATTRIBUTE =
      AuthServeletHandlerRegistry.class.getName() + ".sessionService";

  private static volatile AuthServeletHandler currentHandler =
      NoopAuthServeletHandler.getInstance();
  private static volatile SessionService currentSessionService;

  public static AuthServeletHandler getHandler() {
    return currentHandler;
  }

  public static AuthServeletHandler getHandler(ServletContext servletContext) {
    if (servletContext != null) {
      Object handler = servletContext.getAttribute(AUTH_HANDLER_ATTRIBUTE);
      if (handler instanceof AuthServeletHandler authServeletHandler) {
        return authServeletHandler;
      }
    }
    return getHandler();
  }

  public static void setHandler(AuthServeletHandler handler) {
    currentHandler = handler;
  }

  public static void setHandler(ServletContext servletContext, AuthServeletHandler handler) {
    if (servletContext != null) {
      servletContext.setAttribute(AUTH_HANDLER_ATTRIBUTE, handler);
    }
    setHandler(handler);
  }

  public static SessionService getSessionService() {
    return currentSessionService;
  }

  public static SessionService getSessionService(ServletContext servletContext) {
    if (servletContext == null) {
      return currentSessionService;
    }
    Object service = servletContext.getAttribute(SESSION_SERVICE_ATTRIBUTE);
    if (service instanceof SessionService sessionService) {
      return sessionService;
    }
    return currentSessionService;
  }

  public static void setSessionService(
      ServletContext servletContext, SessionService sessionService) {
    if (servletContext != null) {
      servletContext.setAttribute(SESSION_SERVICE_ATTRIBUTE, sessionService);
    }
    currentSessionService = sessionService;
  }
}
