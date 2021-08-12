---
description: >-
  This section explains how to perform common activities such as reporting a bug
  or merging a pull request.
---

# Coding Style

## Basics

1. Avoid cryptic abbreviations. Single letter variable names are fine in very short methods with few variables, otherwise make them informative.
2. Clear code is preferable to comments. When possible make your naming so good you don't need comments. When that isn't possible comments should be thought of as mandatory, write them to be read.
3. Logging, configuration, and public APIs are our "UI". Make them pretty, consistent, and usable.
4. Maximum line length is 120.
5. Don't leave TODOs in the code or FIXMEs if you can help it. Don't leave println statements in the code. TODOs should be filed as github tasks.
6. User documentation should be considered a part of any user-facing the feature, just like unit tests. Example REST apis should've accompanying documentation.
7. Tests should never rely on timing in order to pass.  
8. Every unit test should leave no side effects, i.e., any test dependencies should be set during setup and clean during tear down.

## Java

1. Apache license headers. Make sure you have Apache License headers in your files. 
2. Tabs vs. spaces. We are using 4 spaces for indentation, not tabs. 
3. Blocks. All statements after if, for, while, do, … must always be encapsulated in a block with curly braces \(even if the block contains one statement\):

   for \(...\) {

   ```text
    ...
   ```

   }

4. No wildcard imports.
5. No unused imports. Remove all unused imports.
6. No raw types. Do not use raw generic types, unless strictly necessary \(sometime necessary for signature matches, arrays\).
7. Suppress warnings. Add annotations to suppress warnings, if they cannot be avoided \(such as “unchecked”, or “serial”\).
8. Comments.  Add JavaDocs to public methods or inherit them by not adding any comments to the methods. 
9. logger instance should be upper case LOG.  
10. When in doubt refer to existing code or  [Java Coding Style](http://google.github.io/styleguide/javaguide.html) except line breaking, which is described above. 

## Logging

1. Please take the time to assess the logs when making a change to ensure that the important things are getting logged and there is no junk there.
2. There are six levels of logging TRACE, DEBUG, INFO, WARN, ERROR, and FATAL, they should be used as follows.

   ```text
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
4. String appending using StringBuilders should not be used for building log messages.

   Formatting should be used. For ex:

   LOG.debug\("Loaded class \[{}\] from jar \[{}\]", className, jarFile\);

