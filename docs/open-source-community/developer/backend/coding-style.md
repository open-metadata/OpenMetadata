# Coding Style

## Basics

1. Avoid cryptic abbreviations. Single letter variable names are fine in very short methods with few variables, otherwise, make them informative.
2. Clear code is preferable to comments. When possible make naming so good that you don't need comments. When that isn't possible comments should be thought of as mandatory, write them to be read.
3. Logging, configuration, and public APIs are our "UI". Make them pretty, consistent, and usable.
4. The maximum line length is 120.
5. Create Github issues instead of leaving `TODO`s and `FIXME`s in code. 
6. Don't leave println statements in the code.
7. User documentation should be considered a part of any user-facing feature, just like unit tests. Eg: REST APIs should've accompanying documentation.
8. Tests should never rely on timing in order to pass.  
9. Every unit test should leave no side effects, i.e., any test dependencies should be set during setup and cleaned during tear down.

## Java

1. Apache license headers. Make sure you have Apache License headers in your files. 
2. We use Google Java Formatter for formatting code. Please run `mvn googleformatter:format@reformat-sources` in the root of your repository before your submit PRs.
3. Blocks. All statements after if, for, while, do, … must always be encapsulated in a block with curly braces (even if the block contains one statement):

    for (...) {

    ```
     ...
    ```

    }
4. No wildcard imports.
5. No raw types. Do not use raw generic types, unless strictly necessary (sometimes necessary for signature matches, arrays).
6. Suppress warnings. Add annotations to suppress warnings, if they cannot be avoided (such as “unchecked”, or “serial”).
7. Comments. Add JavaDocs to public methods or inherit them by not adding any comments to the methods. 
8. Logger instance should be upper case LOG.  
9. When in doubt refer to existing code or  [Java Coding Style](http://google.github.io/styleguide/javaguide.html) except line breaking, which is described above. 

## Logging

1. Please take the time to assess the logs when making a change to ensure that the important things are getting logged and do not add unnecessary noise.
2. There are six levels of logging TRACE, DEBUG, INFO, WARN, ERROR, and FATAL, they should be used as follows.

    ```
    2.1 INFO is the level you should assume the software will be run in. 
     INFO messages are things which are not bad but which the user will definitely want to know about
     every time they occur.

    2.2 TRACE and DEBUG are both things you turn on when something is wrong and you want to figure out 
    what is going on. DEBUG should not be so fine grained that it will seriously effect the performance 
    of the server. TRACE can be anything. Both DEBUG and TRACE statements should be 
    wrapped in an if(logger.isDebugEnabled) if an expensive computation in the argument list of log method call.

    2.3 WARN and ERROR indicate something that is bad. Use WARN if you aren't totally sure it is bad,
     and ERROR if you are.

    2.4 Use FATAL only right before calling System.exit().
    ```
3. Logging statements should be complete sentences with proper capitalization that are written to be read by a person not necessarily familiar with the source code.
4. String appending using StringBuilder should not be used for building log messages.

    Formatting should be used. For example:

    ```java
    LOG.debug("Loaded class {} from jar {}", className, jarFile);
    ```
