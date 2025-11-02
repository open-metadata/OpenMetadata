// To parse this data:
//
//   import { Convert, ResourcePermission } from "./file";
//
//   const resourcePermission = Convert.toResourcePermission(json);
//
// These functions will throw an error if the JSON doesn't
// match the expected interface, even if the JSON is valid.

/**
 * A set of permissions for a user that shows what operation is denied, allowed, or not
 * allowed for all the resources.
 */
export interface ResourcePermission {
    /**
     * Permissions for a `resource`.
     */
    permissions: Permission[];
    /**
     * Name of the resource
     */
    resource: string;
}

export interface Permission {
    /**
     * Access decided after evaluating rules in a policy. Note the access is defined in the
     * order of precedence.
     */
    access?: Access;
    /**
     * Operation names related to the `resource`.
     */
    operation?: Operation;
    /**
     * Name of the policy where the `rule` is from.
     */
    policy?: string;
    /**
     * Name of the role where the `policy` is from. If this is not role based policy, `role` is
     * set to null
     */
    role?: string;
    /**
     * Rule that matches the resource and the operation that decided the `access` as `allow` or
     * `deny`. When no rule matches, the `access` is set to `notAllow`. When access can't be
     * determined because all information required to match the `condition` in the rule,
     * `access` is set to `conditional`.
     */
    rule?: Rule;
}

/**
 * Access decided after evaluating rules in a policy. Note the access is defined in the
 * order of precedence.
 */
export enum Access {
    Allow = "allow",
    ConditionalAllow = "conditionalAllow",
    ConditionalDeny = "conditionalDeny",
    Deny = "deny",
    NotAllow = "notAllow",
}

/**
 * Operation names related to the `resource`.
 *
 * This schema defines all possible operations on metadata of entities in OpenMetadata.
 */
export enum Operation {
    All = "All",
    Create = "Create",
    CreateIngestionPipelineAutomator = "CreateIngestionPipelineAutomator",
    CreateScim = "CreateScim",
    Delete = "Delete",
    DeleteScim = "DeleteScim",
    DeleteTestCaseFailedRowsSample = "DeleteTestCaseFailedRowsSample",
    Deploy = "Deploy",
    EditAll = "EditAll",
    EditCertification = "EditCertification",
    EditCustomFields = "EditCustomFields",
    EditDataProfile = "EditDataProfile",
    EditDescription = "EditDescription",
    EditDisplayName = "EditDisplayName",
    EditEntityRelationship = "EditEntityRelationship",
    EditGlossaryTerms = "EditGlossaryTerms",
    EditIngestionPipelineStatus = "EditIngestionPipelineStatus",
    EditKnowledgePanel = "EditKnowledgePanel",
    EditLifeCycle = "EditLifeCycle",
    EditLineage = "EditLineage",
    EditOwners = "EditOwners",
    EditPage = "EditPage",
    EditPolicy = "EditPolicy",
    EditQueries = "EditQueries",
    EditReviewers = "EditReviewers",
    EditRole = "EditRole",
    EditSampleData = "EditSampleData",
    EditScim = "EditScim",
    EditStatus = "EditStatus",
    EditTags = "EditTags",
    EditTeams = "EditTeams",
    EditTests = "EditTests",
    EditTier = "EditTier",
    EditUsage = "EditUsage",
    EditUsers = "EditUsers",
    GenerateToken = "GenerateToken",
    Impersonate = "Impersonate",
    Kill = "Kill",
    Trigger = "Trigger",
    ViewAll = "ViewAll",
    ViewBasic = "ViewBasic",
    ViewCustomProperties = "ViewCustomProperties",
    ViewDataProfile = "ViewDataProfile",
    ViewProfilerGlobalConfiguration = "ViewProfilerGlobalConfiguration",
    ViewQueries = "ViewQueries",
    ViewSampleData = "ViewSampleData",
    ViewScim = "ViewScim",
    ViewTestCaseFailedRowsSample = "ViewTestCaseFailedRowsSample",
    ViewTests = "ViewTests",
    ViewUsage = "ViewUsage",
}

/**
 * Rule that matches the resource and the operation that decided the `access` as `allow` or
 * `deny`. When no rule matches, the `access` is set to `notAllow`. When access can't be
 * determined because all information required to match the `condition` in the rule,
 * `access` is set to `conditional`.
 *
 * Describes an Access Control Rule for OpenMetadata Metadata Operations. All non-null user
 * (subject) and entity (object) attributes are evaluated with logical AND.
 */
export interface Rule {
    /**
     * Expression in SpEL used for matching of a `Rule` based on entity, resource, and
     * environmental attributes.
     */
    condition?: string;
    /**
     * Description of the rule.
     */
    description?: string;
    effect:       Effect;
    /**
     * FullyQualifiedName in the form `policyName.ruleName`.
     */
    fullyQualifiedName?: string;
    /**
     * Name of this Rule.
     */
    name: string;
    /**
     * List of operation names related to the `resources`. Use `*` to include all the operations.
     */
    operations: Operation[];
    /**
     * Resources/objects related to this rule. Resources are typically `entityTypes` such as
     * `table`, `database`, etc. It also includes `non-entityType` resources such as `lineage`.
     * Use `*` to include all the resources.
     */
    resources: string[];
}

export enum Effect {
    Allow = "allow",
    Deny = "deny",
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
    public static toResourcePermission(json: string): ResourcePermission {
        return cast(JSON.parse(json), r("ResourcePermission"));
    }

    public static resourcePermissionToJson(value: ResourcePermission): string {
        return JSON.stringify(uncast(value, r("ResourcePermission")), null, 2);
    }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ''): never {
    const prettyTyp = prettyTypeName(typ);
    const parentText = parent ? ` on ${parent}` : '';
    const keyText = key ? ` for key "${key}"` : '';
    throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
    if (Array.isArray(typ)) {
        if (typ.length === 2 && typ[0] === undefined) {
            return `an optional ${prettyTypeName(typ[1])}`;
        } else {
            return `one of [${typ.map(a => { return prettyTypeName(a); }).join(", ")}]`;
        }
    } else if (typeof typ === "object" && typ.literal !== undefined) {
        return typ.literal;
    } else {
        return typeof typ;
    }
}

function jsonToJSProps(typ: any): any {
    if (typ.jsonToJS === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.json] = { key: p.js, typ: p.typ });
        typ.jsonToJS = map;
    }
    return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
    if (typ.jsToJSON === undefined) {
        const map: any = {};
        typ.props.forEach((p: any) => map[p.js] = { key: p.json, typ: p.typ });
        typ.jsToJSON = map;
    }
    return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = '', parent: any = ''): any {
    function transformPrimitive(typ: string, val: any): any {
        if (typeof typ === typeof val) return val;
        return invalidValue(typ, val, key, parent);
    }

    function transformUnion(typs: any[], val: any): any {
        // val must validate against one typ in typs
        const l = typs.length;
        for (let i = 0; i < l; i++) {
            const typ = typs[i];
            try {
                return transform(val, typ, getProps);
            } catch (_) {}
        }
        return invalidValue(typs, val, key, parent);
    }

    function transformEnum(cases: string[], val: any): any {
        if (cases.indexOf(val) !== -1) return val;
        return invalidValue(cases.map(a => { return l(a); }), val, key, parent);
    }

    function transformArray(typ: any, val: any): any {
        // val must be an array with no invalid elements
        if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
        return val.map(el => transform(el, typ, getProps));
    }

    function transformDate(val: any): any {
        if (val === null) {
            return null;
        }
        const d = new Date(val);
        if (isNaN(d.valueOf())) {
            return invalidValue(l("Date"), val, key, parent);
        }
        return d;
    }

    function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
        if (val === null || typeof val !== "object" || Array.isArray(val)) {
            return invalidValue(l(ref || "object"), val, key, parent);
        }
        const result: any = {};
        Object.getOwnPropertyNames(props).forEach(key => {
            const prop = props[key];
            const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
            result[prop.key] = transform(v, prop.typ, getProps, key, ref);
        });
        Object.getOwnPropertyNames(val).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(props, key)) {
                result[key] = transform(val[key], additional, getProps, key, ref);
            }
        });
        return result;
    }

    if (typ === "any") return val;
    if (typ === null) {
        if (val === null) return val;
        return invalidValue(typ, val, key, parent);
    }
    if (typ === false) return invalidValue(typ, val, key, parent);
    let ref: any = undefined;
    while (typeof typ === "object" && typ.ref !== undefined) {
        ref = typ.ref;
        typ = typeMap[typ.ref];
    }
    if (Array.isArray(typ)) return transformEnum(typ, val);
    if (typeof typ === "object") {
        return typ.hasOwnProperty("unionMembers") ? transformUnion(typ.unionMembers, val)
            : typ.hasOwnProperty("arrayItems")    ? transformArray(typ.arrayItems, val)
            : typ.hasOwnProperty("props")         ? transformObject(getProps(typ), typ.additional, val)
            : invalidValue(typ, val, key, parent);
    }
    // Numbers can be parsed by Date but shouldn't be.
    if (typ === Date && typeof val !== "number") return transformDate(val);
    return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
    return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
    return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
    return { literal: typ };
}

function a(typ: any) {
    return { arrayItems: typ };
}

function u(...typs: any[]) {
    return { unionMembers: typs };
}

function o(props: any[], additional: any) {
    return { props, additional };
}

function m(additional: any) {
    return { props: [], additional };
}

function r(name: string) {
    return { ref: name };
}

const typeMap: any = {
    "ResourcePermission": o([
        { json: "permissions", js: "permissions", typ: a(r("Permission")) },
        { json: "resource", js: "resource", typ: "" },
    ], false),
    "Permission": o([
        { json: "access", js: "access", typ: u(undefined, r("Access")) },
        { json: "operation", js: "operation", typ: u(undefined, r("Operation")) },
        { json: "policy", js: "policy", typ: u(undefined, "") },
        { json: "role", js: "role", typ: u(undefined, "") },
        { json: "rule", js: "rule", typ: u(undefined, r("Rule")) },
    ], false),
    "Rule": o([
        { json: "condition", js: "condition", typ: u(undefined, "") },
        { json: "description", js: "description", typ: u(undefined, "") },
        { json: "effect", js: "effect", typ: r("Effect") },
        { json: "fullyQualifiedName", js: "fullyQualifiedName", typ: u(undefined, "") },
        { json: "name", js: "name", typ: "" },
        { json: "operations", js: "operations", typ: a(r("Operation")) },
        { json: "resources", js: "resources", typ: a("") },
    ], false),
    "Access": [
        "allow",
        "conditionalAllow",
        "conditionalDeny",
        "deny",
        "notAllow",
    ],
    "Operation": [
        "All",
        "Create",
        "CreateIngestionPipelineAutomator",
        "CreateScim",
        "Delete",
        "DeleteScim",
        "DeleteTestCaseFailedRowsSample",
        "Deploy",
        "EditAll",
        "EditCertification",
        "EditCustomFields",
        "EditDataProfile",
        "EditDescription",
        "EditDisplayName",
        "EditEntityRelationship",
        "EditGlossaryTerms",
        "EditIngestionPipelineStatus",
        "EditKnowledgePanel",
        "EditLifeCycle",
        "EditLineage",
        "EditOwners",
        "EditPage",
        "EditPolicy",
        "EditQueries",
        "EditReviewers",
        "EditRole",
        "EditSampleData",
        "EditScim",
        "EditStatus",
        "EditTags",
        "EditTeams",
        "EditTests",
        "EditTier",
        "EditUsage",
        "EditUsers",
        "GenerateToken",
        "Impersonate",
        "Kill",
        "Trigger",
        "ViewAll",
        "ViewBasic",
        "ViewCustomProperties",
        "ViewDataProfile",
        "ViewProfilerGlobalConfiguration",
        "ViewQueries",
        "ViewSampleData",
        "ViewScim",
        "ViewTestCaseFailedRowsSample",
        "ViewTests",
        "ViewUsage",
    ],
    "Effect": [
        "allow",
        "deny",
    ],
};
