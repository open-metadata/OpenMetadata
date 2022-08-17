package org.openmetadata.client.listUtils;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.openmetadata.client.model.Paging;

public class ListUtils {

  private ListUtils() {}

  public static ArrayList<Object> listResults(Object client, String methodName, Class<?> className)
      throws NoSuchMethodException, InvocationTargetException, IllegalAccessException, InstantiationException {
    Map<String, Object> data = new HashMap<>();
    Object classInstance = className.getDeclaredConstructor().newInstance();
    ArrayList<Object> arrayList = new ArrayList<>();
    Paging paging;
    String after;
    Method method = client.getClass().getMethod(methodName, Map.class);
    Method getData = classInstance.getClass().getMethod("getData");
    Method getPaging = classInstance.getClass().getMethod("getPaging");
    do {
      classInstance = method.invoke(client, data);
      arrayList.addAll((Collection<?>) getData.invoke(classInstance));
      paging = (Paging) getPaging.invoke(classInstance);
      after = paging.getAfter();
      data.put("after", after);
    } while (after != null);
    return arrayList;
  }
}
