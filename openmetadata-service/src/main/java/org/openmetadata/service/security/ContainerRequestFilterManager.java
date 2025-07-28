package org.openmetadata.service.security;

import jakarta.ws.rs.container.ContainerRequestFilter;
import java.util.concurrent.locks.ReadWriteLock;
import java.util.concurrent.locks.ReentrantReadWriteLock;

public class ContainerRequestFilterManager {
  private static final ContainerRequestFilterManager INSTANCE = new ContainerRequestFilterManager();
  private final ReadWriteLock lock = new ReentrantReadWriteLock();
  private ContainerRequestFilter currentFilter;

  private ContainerRequestFilterManager() {}

  public static ContainerRequestFilterManager getInstance() {
    return INSTANCE;
  }

  public void registerFilter(ContainerRequestFilter filter) {
    lock.writeLock().lock();
    try {
      currentFilter = filter;
    } finally {
      lock.writeLock().unlock();
    }
  }

  public ContainerRequestFilter getFilter() {
    lock.readLock().lock();
    try {
      return currentFilter;
    } finally {
      lock.readLock().unlock();
    }
  }

  public void updateFilter(ContainerRequestFilter newFilter) {
    lock.writeLock().lock();
    try {
      currentFilter = newFilter;
    } finally {
      lock.writeLock().unlock();
    }
  }
}
