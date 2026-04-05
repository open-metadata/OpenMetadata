public class VerifyYamlFix {
    public static void main(String[] args) {
        String[] testCases = {
            "plainvalue", "value_with_#_hash", "{}", ">block", "|literal", "key: value", "  spaced  ",
            "true", "FALSE", "null", "Null", "yes", "no", "on", "off", "maybe"
        };

        System.out.println("--- YAML Quoting Verification (Refined) ---");
        for (String test : testCases) {
            boolean needsQuoting = needsYamlQuoting(test);
            String result = needsQuoting ? yamlDoubleQuote(test) : test;
            System.out.printf("In: [%s] -> Needs Quoting: %b -> Result: [%s]%n", test, needsQuoting, result);
        }
    }

    static boolean needsYamlQuoting(String value) {
        if (value.isEmpty()) return false;
        
        // Flow mappings/sequences
        if ((value.startsWith("[") && value.endsWith("]")) || (value.startsWith("{") && value.endsWith("}"))) return false;
        
        // Already quoted (simplified check for script)
        String trimmed = value.trim();
        if (trimmed.length() >= 2) {
            char first = trimmed.charAt(0);
            char last = trimmed.charAt(trimmed.length() - 1);
            if ((first == '"' && last == '"') || (first == '\'' && last == '\'')) return false;
        }

        char first = value.charAt(0);
        String indicators = ">|*&!%@`'\"{[?,#";
        if (indicators.indexOf(first) != -1) return true;

        // Reserved words
        String lower = trimmed.toLowerCase();
        switch (lower) {
            case "true": case "false": case "null": case "yes": case "no": case "on": case "off":
                return true;
        }

        if (value.contains(" #") || value.contains("\t#") || value.contains(": ") || value.endsWith(":") || value.indexOf('\n') >= 0 || value.indexOf('\r') >= 0) return true;
        
        char last = value.charAt(value.length() - 1);
        return (first == ' ' || first == '\t' || last == ' ' || last == '\t');
    }

    static String yamlDoubleQuote(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r") + "\"";
    }
}
