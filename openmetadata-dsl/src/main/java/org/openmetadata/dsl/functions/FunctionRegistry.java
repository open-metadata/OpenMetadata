/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.dsl.functions;

import java.util.HashMap;
import java.util.Map;
import org.openmetadata.dsl.evaluation.EvaluationContext;
import org.openmetadata.dsl.exceptions.EvaluationException;

public class FunctionRegistry {

  private final Map<String, DSLFunction> functions = new HashMap<>();

  public FunctionRegistry() {
    registerBuiltInFunctions();
  }

  private void registerBuiltInFunctions() {
    register("length", new LengthFunction());
    register("contains", new ContainsFunction());
    register("startsWith", new StartsWithFunction());
    register("endsWith", new EndsWithFunction());
    register("isEmpty", new IsEmptyFunction());
    register("toLowerCase", new ToLowerCaseFunction());
    register("toUpperCase", new ToUpperCaseFunction());
  }

  public void register(String name, DSLFunction function) {
    functions.put(name, function);
  }

  public Object invoke(String name, Object[] arguments, EvaluationContext context) {
    DSLFunction function = functions.get(name);
    if (function == null) {
      throw new EvaluationException("Unknown function: " + name);
    }

    return function.execute(arguments, context);
  }

  public boolean exists(String name) {
    return functions.containsKey(name);
  }

  @FunctionalInterface
  public interface DSLFunction {
    Object execute(Object[] arguments, EvaluationContext context);
  }

  private static class LengthFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 1) {
        throw new EvaluationException("length() function expects 1 argument");
      }

      Object arg = arguments[0];
      if (arg == null) {
        return 0;
      }
      if (arg instanceof String) {
        return ((String) arg).length();
      }
      if (arg instanceof java.util.Collection) {
        return ((java.util.Collection<?>) arg).size();
      }
      if (arg.getClass().isArray()) {
        return java.lang.reflect.Array.getLength(arg);
      }

      throw new EvaluationException(
          "length() function cannot be applied to " + arg.getClass().getSimpleName());
    }
  }

  private static class ContainsFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 2) {
        throw new EvaluationException("contains() function expects 2 arguments");
      }

      Object container = arguments[0];
      Object item = arguments[1];

      if (container == null) {
        return false;
      }

      if (container instanceof String && item instanceof String) {
        return ((String) container).contains((String) item);
      }

      if (container instanceof java.util.Collection) {
        return ((java.util.Collection<?>) container).contains(item);
      }

      throw new EvaluationException(
          "contains() function cannot be applied to " + container.getClass().getSimpleName());
    }
  }

  private static class StartsWithFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 2) {
        throw new EvaluationException("startsWith() function expects 2 arguments");
      }

      Object str = arguments[0];
      Object prefix = arguments[1];

      if (str == null || prefix == null) {
        return false;
      }

      if (str instanceof String && prefix instanceof String) {
        return ((String) str).startsWith((String) prefix);
      }

      throw new EvaluationException("startsWith() function can only be applied to strings");
    }
  }

  private static class EndsWithFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 2) {
        throw new EvaluationException("endsWith() function expects 2 arguments");
      }

      Object str = arguments[0];
      Object suffix = arguments[1];

      if (str == null || suffix == null) {
        return false;
      }

      if (str instanceof String && suffix instanceof String) {
        return ((String) str).endsWith((String) suffix);
      }

      throw new EvaluationException("endsWith() function can only be applied to strings");
    }
  }

  private static class IsEmptyFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 1) {
        throw new EvaluationException("isEmpty() function expects 1 argument");
      }

      Object arg = arguments[0];
      if (arg == null) {
        return true;
      }

      if (arg instanceof String) {
        return ((String) arg).isEmpty();
      }

      if (arg instanceof java.util.Collection) {
        return ((java.util.Collection<?>) arg).isEmpty();
      }

      return false;
    }
  }

  private static class ToLowerCaseFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 1) {
        throw new EvaluationException("toLowerCase() function expects 1 argument");
      }

      Object arg = arguments[0];
      if (arg == null) {
        return null;
      }

      if (arg instanceof String) {
        return ((String) arg).toLowerCase();
      }

      throw new EvaluationException("toLowerCase() function can only be applied to strings");
    }
  }

  private static class ToUpperCaseFunction implements DSLFunction {
    @Override
    public Object execute(Object[] arguments, EvaluationContext context) {
      if (arguments.length != 1) {
        throw new EvaluationException("toUpperCase() function expects 1 argument");
      }

      Object arg = arguments[0];
      if (arg == null) {
        return null;
      }

      if (arg instanceof String) {
        return ((String) arg).toUpperCase();
      }

      throw new EvaluationException("toUpperCase() function can only be applied to strings");
    }
  }
}
