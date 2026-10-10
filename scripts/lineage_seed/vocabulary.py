"""The business vocabulary the seeded catalog is written in.

Everything a human reads in the UI — domain, system, table and column names, and every
description — comes from here, so the lineage map and the entity pages look like a real company's
data platform instead of `t123.col_4`. catalog.py combines these deterministically; nothing here
is random.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Attribute:
    """A business column. `kind` picks its type, description template and tags (see KINDS)."""

    name: str
    kind: str
    examples: str = ""


@dataclass(frozen=True)
class Concept:
    """A business entity, e.g. orders. Its tables at every layer derive their columns from it."""

    plural: str
    singular: str
    refs: tuple[str, ...]
    attributes: tuple[Attribute, ...]


@dataclass(frozen=True)
class System:
    """An operational application with its own database — one source database service."""

    name: str
    engine: str
    description: str
    databases: tuple[str, ...]


@dataclass(frozen=True)
class Domain:
    name: str
    display: str
    domain_type: str
    description: str
    weight: int
    warehouse: str
    mart_warehouse: str
    bi: str
    team: str
    systems: tuple[System, ...]
    concepts: tuple[Concept, ...]
    subjects: tuple[str, ...]
    data_products: tuple[tuple[str, str], ...] = field(default_factory=tuple)


def _a(name: str, kind: str, examples: str = "") -> Attribute:
    return Attribute(name, kind, examples)


# The vocabulary below is data, laid out for reading rather than by the formatter.
# fmt: off

# Column kinds: (data type, length or (precision, scale), description template, tag FQN).
# Templates receive: label (from the column name), entity (the concept's singular), domain.
KINDS: dict[str, tuple[str, object, str, str | None]] = {
    "status": ("VARCHAR", 32, "{Label} of the {entity}: one of {examples}.", None),
    "amount": ("DECIMAL", (18, 2), "{Label} of the {entity}, in its transaction currency, rounded to cents.", None),
    "currency": ("CHAR", 3, "ISO 4217 code of the currency the {entity}'s amounts are expressed in.", None),
    "timestamp": ("TIMESTAMP", None, "Time the {entity} was {verb}, in UTC.", None),
    "date": ("DATE", None, "{Label} of the {entity} (calendar date, UTC).", None),
    "category": ("VARCHAR", 64, "{Label} of the {entity}; a low-cardinality dimension used to group reports.", None),
    "count": ("INT", None, "{Label} on the {entity}.", None),
    "rate": ("DOUBLE", None, "{Label} of the {entity}, as a fraction between 0 and 1.", None),
    "score": ("DOUBLE", None, "{Label} from the {domain} scoring model, between 0 and 1; higher is more likely.", None),
    "country": ("CHAR", 2, "ISO 3166-1 alpha-2 code of the {label_lower}.", None),
    "flag": ("BOOLEAN", None, "Whether the {entity} {flag_phrase}.", None),
    "text": ("TEXT", None, "Free-text {label_lower} entered by users. May contain personal data.", "PII.Sensitive"),
    "email": ("VARCHAR", 320, "Email address of the {entity}. Personal data: masked outside the {domain} domain.", "PII.Sensitive"),
    "phone": ("VARCHAR", 32, "Phone number of the {entity} in E.164 format. Personal data.", "PII.Sensitive"),
    "person_name": ("VARCHAR", 200, "{Label} of the {entity} as they entered it. Personal data.", "PII.Sensitive"),
    "address": ("VARCHAR", 500, "{Label} of the {entity}. Personal data.", "PII.Sensitive"),
    "ip": ("VARCHAR", 45, "Client IP address (IPv4 or IPv6) the {entity} came from.", "PII.NonSensitive"),
    "duration": ("INT", None, "{Label} of the {entity}, in seconds.", None),
    "identifier": ("VARCHAR", 64, "{Label} of the {entity}, as assigned by the upstream system.", None),
    "json": ("JSON", None, "{Label} of the {entity}, kept verbatim from the source for audit.", None),
}


SALES = Domain(
    name="sales",
    display="Sales",
    domain_type="Source-aligned",
    description="Orders, quotes and the commercial pipeline, from first quote to booked revenue.",
    weight=16,
    warehouse="snowflake_prod_amer",
    mart_warehouse="snowflake_prod_amer",
    bi="looker_prod",
    team="Sales Analytics",
    systems=(
        System("order_service", "Postgres", "Checkout and order management for the web and mobile stores.", ("orders", "checkout")),
        System("crm", "Mysql", "Customer relationship management: accounts, opportunities and quotes.", ("crm", "crm_archive")),
        System("pos", "Mssql", "Point-of-sale system of the retail stores.", ("pos_store", "pos_sync")),
    ),
    concepts=(
        Concept("orders", "order", ("customer", "sales_rep", "store"), (
            _a("status", "status", "PLACED, PAID, SHIPPED, DELIVERED, CANCELLED"),
            _a("total_amount", "amount"), _a("discount_amount", "amount"), _a("currency", "currency"),
            _a("sales_channel", "category"), _a("placed_at", "timestamp"), _a("item_count", "count"),
            _a("shipping_country", "country"), _a("is_gift", "flag"))),
        Concept("order_items", "order item", ("order", "product"), (
            _a("quantity", "count"), _a("unit_price", "amount"), _a("line_amount", "amount"),
            _a("currency", "currency"), _a("fulfilment_status", "status", "PENDING, PICKED, PACKED, SHIPPED"))),
        Concept("quotes", "quote", ("account", "sales_rep"), (
            _a("status", "status", "DRAFT, SENT, ACCEPTED, EXPIRED"), _a("quoted_amount", "amount"),
            _a("currency", "currency"), _a("expiry_date", "date"), _a("sent_at", "timestamp"))),
        Concept("opportunities", "opportunity", ("account", "sales_rep"), (
            _a("stage", "status", "PROSPECT, QUALIFIED, PROPOSAL, WON, LOST"), _a("expected_amount", "amount"),
            _a("win_probability", "rate"), _a("close_date", "date"), _a("lead_source", "category"))),
        Concept("accounts", "account", ("territory", "sales_rep"), (
            _a("account_name", "person_name"), _a("industry", "category"), _a("billing_country", "country"),
            _a("annual_revenue", "amount"), _a("is_strategic", "flag"), _a("created_at", "timestamp"))),
        Concept("returns", "return", ("order", "customer"), (
            _a("reason", "category"), _a("refund_amount", "amount"), _a("currency", "currency"),
            _a("received_at", "timestamp"), _a("status", "status", "REQUESTED, RECEIVED, REFUNDED, REJECTED"))),
        Concept("sales_reps", "sales rep", ("territory",), (
            _a("full_name", "person_name"), _a("work_email", "email"), _a("quota_amount", "amount"),
            _a("hired_on", "date"), _a("is_active", "flag"))),
    ),
    subjects=("commercial", "orders", "revenue", "pipeline", "accounts"),
    data_products=(
        ("sales_orders", "Governed order and order-line facts for revenue reporting."),
        ("sales_pipeline", "Opportunity and quote funnel with stage history."),
        ("sales_accounts", "Account master data with ownership and territories."),
        ("sales_performance", "Rep and territory performance against quota."),
    ),
)

MARKETING = Domain(
    name="marketing",
    display="Marketing",
    domain_type="Consumer-aligned",
    description="Campaigns, web traffic, leads and attribution of spend to revenue.",
    weight=12,
    warehouse="snowflake_prod_amer",
    mart_warehouse="bigquery_analytics",
    bi="looker_prod",
    team="Growth Marketing Analytics",
    systems=(
        System("campaign_manager", "Postgres", "Campaign planning, budgets and email sends.", ("campaigns", "email")),
        System("web_tracking", "Mysql", "First-party web and app event collection.", ("tracking", "sessions")),
    ),
    concepts=(
        Concept("campaigns", "campaign", ("channel",), (
            _a("campaign_name", "identifier"), _a("objective", "category"), _a("budget_amount", "amount"),
            _a("currency", "currency"), _a("launched_at", "timestamp"), _a("status", "status", "PLANNED, LIVE, PAUSED, ENDED"))),
        Concept("ad_spend", "ad spend record", ("campaign", "channel"), (
            _a("spend_amount", "amount"), _a("currency", "currency"), _a("impressions", "count"),
            _a("clicks", "count"), _a("spend_date", "date"))),
        Concept("web_sessions", "web session", ("visitor", "campaign"), (
            _a("landing_page", "identifier"), _a("device_type", "category"), _a("session_seconds", "duration"),
            _a("page_views", "count"), _a("client_ip", "ip"), _a("started_at", "timestamp"), _a("is_bounce", "flag"))),
        Concept("leads", "lead", ("campaign", "account"), (
            _a("contact_email", "email"), _a("full_name", "person_name"), _a("lead_score", "score"),
            _a("source", "category"), _a("captured_at", "timestamp"), _a("status", "status", "NEW, WORKING, QUALIFIED, DISQUALIFIED"))),
        Concept("email_sends", "email send", ("campaign", "lead"), (
            _a("template", "identifier"), _a("sent_at", "timestamp"), _a("opened", "count"),
            _a("clicked", "count"), _a("bounce_type", "category"))),
        Concept("attribution_touches", "attribution touch", ("campaign", "order"), (
            _a("touch_type", "category"), _a("credited_amount", "amount"), _a("currency", "currency"),
            _a("touched_at", "timestamp"), _a("position_weight", "rate"))),
    ),
    subjects=("campaigns", "web", "leads", "attribution", "spend"),
    data_products=(
        ("marketing_attribution", "Multi-touch attribution of revenue to campaigns."),
        ("marketing_web_analytics", "Sessionised web and app traffic."),
        ("marketing_leads", "Lead funnel from capture to qualification."),
        ("marketing_spend", "Paid media spend and efficiency by channel."),
    ),
)

FINANCE = Domain(
    name="finance",
    display="Finance",
    domain_type="Aggregate",
    description="General ledger, invoicing, payments and the monthly close.",
    weight=10,
    warehouse="redshift_finance",
    mart_warehouse="redshift_finance",
    bi="powerbi_finance",
    team="Finance Data",
    systems=(
        System("erp", "Oracle", "Enterprise resource planning: ledger, payables and receivables.", ("erp_gl", "erp_ap", "erp_ar")),
        System("billing", "Postgres", "Subscription billing and invoicing.", ("billing", "billing_events")),
    ),
    concepts=(
        Concept("gl_entries", "ledger entry", ("cost_center", "account"), (
            _a("debit_amount", "amount"), _a("credit_amount", "amount"), _a("currency", "currency"),
            _a("posting_date", "date"), _a("journal_type", "category"), _a("is_reversal", "flag"))),
        Concept("invoices", "invoice", ("customer", "subscription"), (
            _a("invoice_number", "identifier"), _a("total_amount", "amount"), _a("tax_amount", "amount"),
            _a("currency", "currency"), _a("issued_on", "date"), _a("due_date", "date"),
            _a("status", "status", "DRAFT, OPEN, PAID, VOID, UNCOLLECTIBLE"))),
        Concept("payments", "payment", ("invoice", "customer"), (
            _a("paid_amount", "amount"), _a("currency", "currency"), _a("method", "category"),
            _a("settled_at", "timestamp"), _a("status", "status", "PENDING, SETTLED, FAILED, REFUNDED"))),
        Concept("budgets", "budget line", ("cost_center",), (
            _a("fiscal_period", "identifier"), _a("planned_amount", "amount"), _a("currency", "currency"),
            _a("approved_at", "timestamp"))),
        Concept("fx_rates", "exchange rate", (), (
            _a("from_currency", "currency"), _a("to_currency", "currency"), _a("rate", "rate"),
            _a("rate_date", "date"))),
        Concept("expenses", "expense", ("employee", "cost_center"), (
            _a("expense_amount", "amount"), _a("currency", "currency"), _a("category", "category"),
            _a("submitted_at", "timestamp"), _a("receipt_notes", "text"))),
    ),
    subjects=("ledger", "receivables", "payables", "planning", "treasury"),
    data_products=(
        ("finance_close", "Month-end close: balanced ledger and accruals."),
        ("finance_receivables", "Invoices, payments and ageing."),
        ("finance_planning", "Budgets versus actuals by cost center."),
        ("finance_fx", "Daily reference exchange rates."),
    ),
)

CUSTOMER = Domain(
    name="customer",
    display="Customer",
    domain_type="Source-aligned",
    description="Customer master data, support interactions, subscriptions and loyalty.",
    weight=12,
    warehouse="snowflake_prod_emea",
    mart_warehouse="snowflake_prod_emea",
    bi="tableau_prod",
    team="Customer Insights",
    systems=(
        System("identity", "Postgres", "Customer accounts, profiles and consent.", ("identity", "consent")),
        System("support_desk", "Mysql", "Support tickets and satisfaction surveys.", ("helpdesk",)),
        System("subscriptions", "Postgres", "Plans, renewals and cancellations.", ("subscriptions",)),
    ),
    concepts=(
        Concept("customers", "customer", ("segment",), (
            _a("email", "email"), _a("full_name", "person_name"), _a("phone", "phone"),
            _a("country", "country"), _a("signed_up_at", "timestamp"), _a("lifetime_value", "amount"),
            _a("currency", "currency"), _a("is_marketing_opt_in", "flag"))),
        Concept("addresses", "address", ("customer",), (
            _a("street_address", "address"), _a("city", "category"), _a("postal_code", "identifier"),
            _a("country", "country"), _a("is_default", "flag"))),
        Concept("support_tickets", "support ticket", ("customer", "agent"), (
            _a("priority", "category"), _a("status", "status", "OPEN, PENDING, SOLVED, CLOSED"),
            _a("opened_at", "timestamp"), _a("resolution_seconds", "duration"), _a("description", "text"))),
        Concept("nps_responses", "survey response", ("customer",), (
            _a("score", "count"), _a("comment", "text"), _a("responded_at", "timestamp"), _a("channel", "category"))),
        Concept("subscriptions", "subscription", ("customer", "plan"), (
            _a("plan_tier", "category"), _a("monthly_amount", "amount"), _a("currency", "currency"),
            _a("started_at", "timestamp"), _a("status", "status", "TRIAL, ACTIVE, PAST_DUE, CANCELLED"),
            _a("churn_probability", "score"))),
        Concept("loyalty_points", "loyalty ledger entry", ("customer",), (
            _a("points", "count"), _a("reason", "category"), _a("earned_at", "timestamp"))),
    ),
    subjects=("customers", "support", "subscriptions", "loyalty", "consent"),
    data_products=(
        ("customer_360", "One governed row per customer with lifetime metrics."),
        ("customer_support", "Ticket volumes, resolution times and satisfaction."),
        ("customer_subscriptions", "Subscription lifecycle and churn signals."),
        ("customer_loyalty", "Points earned, burned and outstanding."),
    ),
)

SUPPLY_CHAIN = Domain(
    name="supply_chain",
    display="Supply Chain",
    domain_type="Source-aligned",
    description="Inventory, purchasing, warehouses and outbound logistics.",
    weight=12,
    warehouse="databricks_lakehouse",
    mart_warehouse="databricks_lakehouse",
    bi="tableau_prod",
    team="Supply Chain Analytics",
    systems=(
        System("wms", "Oracle", "Warehouse management: receiving, putaway, picking.", ("wms_core", "wms_events")),
        System("procurement", "Mssql", "Purchase orders and supplier management.", ("procurement",)),
        System("tms", "Postgres", "Transport management and carrier tracking.", ("transport",)),
    ),
    concepts=(
        Concept("shipments", "shipment", ("order", "carrier", "warehouse"), (
            _a("tracking_number", "identifier"), _a("status", "status", "CREATED, IN_TRANSIT, DELIVERED, LOST"),
            _a("shipped_at", "timestamp"), _a("freight_cost", "amount"), _a("currency", "currency"),
            _a("destination_country", "country"))),
        Concept("inventory_levels", "inventory snapshot", ("product", "warehouse"), (
            _a("on_hand_units", "count"), _a("reserved_units", "count"), _a("snapshot_date", "date"),
            _a("is_below_safety_stock", "flag"))),
        Concept("purchase_orders", "purchase order", ("supplier", "warehouse"), (
            _a("po_number", "identifier"), _a("ordered_amount", "amount"), _a("currency", "currency"),
            _a("expected_on", "date"), _a("status", "status", "OPEN, CONFIRMED, RECEIVED, CLOSED"))),
        Concept("suppliers", "supplier", (), (
            _a("supplier_name", "person_name"), _a("contact_email", "email"), _a("country", "country"),
            _a("reliability_rate", "rate"), _a("is_preferred", "flag"))),
        Concept("stock_movements", "stock movement", ("product", "warehouse"), (
            _a("movement_type", "category"), _a("units", "count"), _a("moved_at", "timestamp"))),
        Concept("demand_forecasts", "demand forecast", ("product", "warehouse"), (
            _a("forecast_units", "count"), _a("forecast_date", "date"), _a("confidence", "rate"))),
    ),
    subjects=("inventory", "logistics", "purchasing", "suppliers", "planning"),
    data_products=(
        ("supply_inventory", "Daily inventory positions per product and warehouse."),
        ("supply_logistics", "Shipment tracking and carrier performance."),
        ("supply_purchasing", "Purchase orders and supplier reliability."),
    ),
)

PRODUCT = Domain(
    name="product",
    display="Product",
    domain_type="Source-aligned",
    description="The product catalog, prices, reviews and in-app behaviour.",
    weight=10,
    warehouse="bigquery_analytics",
    mart_warehouse="bigquery_analytics",
    bi="looker_prod",
    team="Product Analytics",
    systems=(
        System("catalog", "Postgres", "Product information management.", ("catalog", "pricing")),
        System("app_events", "Mysql", "Mobile and web application telemetry.", ("events",)),
    ),
    concepts=(
        Concept("products", "product", ("category", "brand"), (
            _a("sku", "identifier"), _a("product_name", "identifier"), _a("list_price", "amount"),
            _a("currency", "currency"), _a("launched_on", "date"), _a("is_discontinued", "flag"))),
        Concept("product_events", "product event", ("product", "user"), (
            _a("event_type", "category"), _a("occurred_at", "timestamp"), _a("platform", "category"),
            _a("properties", "json"))),
        Concept("reviews", "review", ("product", "customer"), (
            _a("rating", "count"), _a("review_text", "text"), _a("submitted_at", "timestamp"),
            _a("is_verified_purchase", "flag"))),
        Concept("price_changes", "price change", ("product",), (
            _a("old_price", "amount"), _a("new_price", "amount"), _a("currency", "currency"),
            _a("effective_on", "date"), _a("reason", "category"))),
        Concept("feature_flags", "feature flag evaluation", ("user",), (
            _a("flag_key", "identifier"), _a("variant", "category"), _a("evaluated_at", "timestamp"))),
    ),
    subjects=("catalog", "engagement", "pricing", "reviews", "experiments"),
    data_products=(
        ("product_catalog", "Current and historical product attributes and prices."),
        ("product_engagement", "Feature adoption and in-app funnels."),
        ("product_reviews", "Ratings and review sentiment."),
    ),
)

PEOPLE = Domain(
    name="people",
    display="People",
    domain_type="Source-aligned",
    description="Employees, organisation structure, payroll and hiring.",
    weight=5,
    warehouse="snowflake_prod_emea",
    mart_warehouse="snowflake_prod_emea",
    bi="tableau_prod",
    team="People Analytics",
    systems=(System("hris", "Oracle", "Human resources information system.", ("hris", "payroll")),),
    concepts=(
        Concept("employees", "employee", ("department", "manager"), (
            _a("full_name", "person_name"), _a("work_email", "email"), _a("home_address", "address"),
            _a("hired_on", "date"), _a("job_level", "category"), _a("is_active", "flag"))),
        Concept("payroll_runs", "payroll line", ("employee",), (
            _a("gross_amount", "amount"), _a("net_amount", "amount"), _a("currency", "currency"),
            _a("pay_date", "date"))),
        Concept("time_off", "time off request", ("employee",), (
            _a("leave_type", "category"), _a("days", "count"), _a("start_date", "date"),
            _a("status", "status", "REQUESTED, APPROVED, REJECTED"))),
        Concept("job_requisitions", "job requisition", ("department",), (
            _a("title", "identifier"), _a("status", "status", "OPEN, ON_HOLD, FILLED, CANCELLED"),
            _a("opened_on", "date"), _a("salary_budget", "amount"), _a("currency", "currency"))),
    ),
    subjects=("workforce", "payroll", "hiring"),
    data_products=(
        ("people_headcount", "Headcount and attrition by department."),
        ("people_payroll", "Payroll cost by cost center."),
    ),
)

RISK = Domain(
    name="risk",
    display="Risk & Compliance",
    domain_type="Consumer-aligned",
    description="Fraud detection, chargebacks, KYC and audit evidence.",
    weight=6,
    warehouse="redshift_finance",
    mart_warehouse="redshift_finance",
    bi="powerbi_finance",
    team="Risk Engineering",
    systems=(System("fraud_engine", "Postgres", "Real-time transaction screening.", ("screening", "cases")),),
    concepts=(
        Concept("transactions", "transaction", ("customer", "merchant"), (
            _a("amount", "amount"), _a("currency", "currency"), _a("card_country", "country"),
            _a("authorised_at", "timestamp"), _a("fraud_score", "score"), _a("is_declined", "flag"))),
        Concept("fraud_alerts", "fraud alert", ("transaction",), (
            _a("rule", "category"), _a("severity", "category"), _a("raised_at", "timestamp"),
            _a("status", "status", "OPEN, CONFIRMED, FALSE_POSITIVE"))),
        Concept("chargebacks", "chargeback", ("transaction", "customer"), (
            _a("disputed_amount", "amount"), _a("currency", "currency"), _a("reason_code", "category"),
            _a("received_at", "timestamp"))),
        Concept("kyc_checks", "KYC check", ("customer",), (
            _a("document_type", "category"), _a("result", "status", "PASSED, FAILED, REVIEW"),
            _a("checked_at", "timestamp"), _a("reviewer_notes", "text"))),
    ),
    subjects=("fraud", "disputes", "kyc", "audit"),
    data_products=(
        ("risk_fraud", "Scored transactions and confirmed fraud."),
        ("risk_disputes", "Chargebacks and their outcomes."),
    ),
)

PLATFORM = Domain(
    name="platform",
    display="Platform",
    domain_type="Aggregate",
    description="Product usage, reliability and cloud cost of the shared platform.",
    weight=9,
    warehouse="databricks_lakehouse",
    mart_warehouse="databricks_lakehouse",
    bi="superset_internal",
    team="Data Platform",
    systems=(
        System("auth_service", "Postgres", "Login and session management.", ("auth",)),
        System("api_gateway", "Mysql", "Request logs of the public API gateway.", ("gateway",)),
    ),
    concepts=(
        Concept("users", "user", ("organisation",), (
            _a("email", "email"), _a("role", "category"), _a("created_at", "timestamp"),
            _a("last_login_ip", "ip"), _a("is_mfa_enabled", "flag"))),
        Concept("sessions", "session", ("user",), (
            _a("client", "category"), _a("started_at", "timestamp"), _a("duration_seconds", "duration"),
            _a("client_ip", "ip"))),
        Concept("api_requests", "API request", ("user",), (
            _a("endpoint", "identifier"), _a("status_code", "count"), _a("latency_ms", "count"),
            _a("requested_at", "timestamp"))),
        Concept("deployments", "deployment", ("service",), (
            _a("version", "identifier"), _a("deployed_at", "timestamp"), _a("is_rollback", "flag"))),
        Concept("cloud_costs", "cloud cost line", ("service",), (
            _a("provider", "category"), _a("cost_amount", "amount"), _a("currency", "currency"),
            _a("usage_date", "date"))),
    ),
    subjects=("usage", "reliability", "cost", "security"),
    data_products=(
        ("platform_usage", "Active users and API consumption."),
        ("platform_reliability", "Deployments, incidents and error budgets."),
        ("platform_cost", "Cloud spend allocated to teams."),
    ),
)

DATA_SCIENCE = Domain(
    name="data_science",
    display="Data Science",
    domain_type="Consumer-aligned",
    description="Feature tables, model training runs and predictions.",
    weight=8,
    warehouse="bigquery_analytics",
    mart_warehouse="bigquery_analytics",
    bi="superset_internal",
    team="Machine Learning",
    systems=(System("experiment_tracker", "Postgres", "Experiment and model-run tracking.", ("experiments",)),),
    concepts=(
        Concept("features", "feature vector", ("customer",), (
            _a("feature_set", "identifier"), _a("computed_at", "timestamp"), _a("values", "json"))),
        Concept("training_runs", "training run", ("model",), (
            _a("dataset_version", "identifier"), _a("started_at", "timestamp"), _a("auc", "rate"),
            _a("duration_seconds", "duration"))),
        Concept("predictions", "prediction", ("model", "customer"), (
            _a("predicted_label", "category"), _a("probability", "score"), _a("predicted_at", "timestamp"))),
        Concept("experiments", "experiment assignment", ("user",), (
            _a("experiment_key", "identifier"), _a("variant", "category"), _a("assigned_at", "timestamp"),
            _a("converted", "flag"))),
    ),
    subjects=("features", "training", "inference", "experiments"),
    data_products=(
        ("ds_features", "Reusable, point-in-time correct feature tables."),
        ("ds_predictions", "Batch predictions with model lineage."),
    ),
)

DOMAINS: tuple[Domain, ...] = (
    SALES, MARKETING, FINANCE, CUSTOMER, SUPPLY_CHAIN, PRODUCT, PEOPLE, RISK, PLATFORM, DATA_SCIENCE,
)

# Shared platform services: warehouses, the event bus, orchestration, BI and ML.
WAREHOUSES: dict[str, tuple[str, str]] = {
    "snowflake_prod_amer": ("Snowflake", "Snowflake account for the Americas business units."),
    "snowflake_prod_emea": ("Snowflake", "Snowflake account for EMEA, data resident in Frankfurt."),
    "redshift_finance": ("Redshift", "Finance and risk warehouse with restricted access."),
    "databricks_lakehouse": ("Databricks", "Lakehouse for operations, logistics and platform data."),
    "bigquery_analytics": ("BigQuery", "Analytics project for product, marketing and data science."),
}
KAFKA_SERVICES: dict[str, tuple[str, str]] = {
    "kafka_cdc_amer": ("Kafka", "Debezium change-data-capture topics for Americas databases."),
    "kafka_cdc_emea": ("Kafka", "Debezium change-data-capture topics for EMEA databases."),
}
PIPELINE_SERVICES: dict[str, tuple[str, str]] = {
    "fivetran": ("Fivetran", "Managed connectors that land source databases in the warehouse."),
    "dbt_cloud": ("DBTCloud", "dbt Cloud jobs that build staging, core and mart models."),
    "airflow_prod": ("Airflow", "Production Airflow: orchestration, reverse ETL and ML training."),
    "spark_jobs": ("Spark", "Spark batch jobs for heavy transformations."),
}
BI_SERVICES: dict[str, tuple[str, str, str]] = {
    "looker_prod": ("Looker", "LookMlExplore", "Company Looker instance."),
    "tableau_prod": ("Tableau", "TableauDataModel", "Tableau Cloud site for operations teams."),
    "powerbi_finance": ("PowerBI", "PowerBIDataModel", "Power BI workspace of Finance and Risk."),
    "superset_internal": ("Superset", "SupersetDataModel", "Internal Superset for engineering teams."),
}
ML_SERVICES: dict[str, tuple[str, str]] = {
    "mlflow_prod": ("Mlflow", "MLflow model registry."),
    "sagemaker": ("SageMaker", "SageMaker endpoints for real-time scoring."),
}

# Variants that make repeated names within one schema distinct and plausible.
QUALIFIERS = (
    "daily", "hourly", "history", "snapshot", "latest", "enriched", "by_region", "by_channel",
    "weekly", "monthly", "deduped", "v2", "summary", "detail", "current", "archive",
)
MART_GRAINS = ("daily", "weekly", "monthly", "by_region", "by_channel", "by_segment")
REGIONS = ("amer", "emea", "apac")
# fmt: on
