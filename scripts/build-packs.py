import json, os, hashlib, datetime

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "packs")
os.makedirs(OUT, exist_ok=True)
TODAY = "2026-08-28"

# (term, aliases, tier, definition)
# tier 1 = plain definition, no link. tier 2 = definition + room for a customer link.
PACKS = {}

PACKS["seo-core"] = dict(
    name="SEO and content marketing",
    note="Universal pack. Load this on every site.",
    terms=[
    ("SEO", ["search engine optimization"], 1, "Improving a site's visibility in organic search results through content, technical structure, and authority."),
    ("SERP", ["search engine results page"], 1, "The page of results returned for a query, including organic links, ads, and enriched features."),
    ("CTR", ["click-through rate"], 1, "The share of people who click a result after seeing it. Clicks divided by impressions."),
    ("impressions", [], 1, "The number of times a page appeared in search results, whether or not anyone clicked."),
    ("canonical tag", ["rel=canonical"], 2, "A link element naming the preferred version of a page, used to consolidate duplicates onto one URL."),
    ("crawl budget", [], 2, "The number of pages a search engine will fetch from a site in a given period. Matters mainly at large scale."),
    ("indexation", ["indexing"], 2, "Whether a page has been stored in a search engine's index and is therefore eligible to rank."),
    ("robots.txt", [], 2, "A root-level file telling crawlers which paths they may request. It controls crawling, not indexing."),
    ("noindex", [], 2, "A directive asking search engines to keep a page out of the index while still allowing it to be crawled."),
    ("XML sitemap", ["sitemap.xml"], 2, "A machine-readable list of a site's URLs submitted to search engines to aid discovery."),
    ("structured data", ["schema markup"], 2, "Machine-readable annotations stating what a page's content means, rather than leaving a parser to infer it."),
    ("JSON-LD", [], 1, "The JSON serialization of linked data, and the format search engines prefer for structured data."),
    ("rich result", ["rich snippet"], 2, "An enhanced search listing showing extra detail such as ratings, prices, or FAQs, driven by structured data."),
    ("Core Web Vitals", [], 2, "Google's page-experience metrics covering loading, interactivity, and layout stability."),
    ("LCP", ["Largest Contentful Paint"], 1, "How long the largest visible element takes to render. A loading-speed metric."),
    ("CLS", ["Cumulative Layout Shift"], 1, "How much visible content moves unexpectedly during load. A visual-stability metric."),
    ("INP", ["Interaction to Next Paint"], 1, "How quickly a page responds to user interaction. Replaced First Input Delay."),
    ("internal linking", [], 2, "Links between pages on the same site. Distributes authority and signals which pages matter."),
    ("anchor text", [], 1, "The visible, clickable words in a link. Describes what the destination is about."),
    ("backlink", ["inbound link"], 1, "A link from another site pointing at yours. A long-standing signal of authority."),
    ("domain authority", [], 2, "A third-party score estimating a domain's ranking strength. Useful for comparison, not a Google metric."),
    ("keyword cannibalization", [], 2, "Several pages on one site competing for the same query, splitting signals between them."),
    ("search intent", ["user intent"], 2, "What a searcher is actually trying to accomplish. Usually grouped as informational, navigational, commercial, or transactional."),
    ("topic cluster", ["content hub"], 2, "A pillar page plus supporting pages on subtopics, interlinked to signal depth on a theme."),
    ("content decay", [], 2, "The gradual traffic loss a page suffers as it ages and competitors publish fresher material."),
    ("E-E-A-T", [], 2, "Experience, expertise, authoritativeness, and trust. Criteria in Google's quality rater guidelines, not a direct ranking factor."),
    ("hreflang", [], 2, "An annotation declaring the language and region a page targets, used to serve the right version internationally."),
    ("pagination", [], 2, "Splitting a long list across numbered pages. Needs care so crawlers reach deep items."),
    ("faceted navigation", [], 2, "Filter-driven URLs on listing pages. A common source of near-duplicate pages and wasted crawl."),
    ("log file analysis", [], 2, "Reading server logs to see what crawlers actually requested, rather than what you assume they did."),
    ("GEO", ["generative engine optimization"], 2, "Optimizing for inclusion and citation in generative search answers rather than classic ranked links."),
    ("AI Overviews", [], 2, "Google's generated summaries shown above traditional results, assembled from retrieved pages."),
    ("RAG", ["retrieval-augmented generation"], 2, "Retrieving source documents at query time and generating an answer grounded in them."),
    ("query fan-out", [], 2, "When a system decomposes one query into several sub-questions and retrieves against each."),
    ("llms.txt", [], 2, "A proposed root-level file offering LLM-oriented site guidance. Adoption and effect remain contested."),
    ("MCP", ["Model Context Protocol"], 2, "Standardizes how an AI host discovers tools and resources from external systems."),
    ("redirect chain", [], 2, "Two or more redirects in sequence before reaching the final URL. Wastes crawl and leaks a little signal each hop."),
    ("orphan page", [], 2, "A page with no internal links pointing to it, so crawlers and users can only reach it by direct URL."),
    ("thin content", [], 2, "A page with too little substance to satisfy the query it targets. Often generated at scale."),
    ("SERP feature", [], 2, "Any non-standard result element such as a featured snippet, knowledge panel, or People Also Ask block."),
])

PACKS["ecommerce"] = dict(
    name="Ecommerce and retail",
    note="Marketplace, DTC, and retail catalog sites.",
    terms=[
    ("AOV", ["average order value"], 1, "Total revenue divided by number of orders. Measures how much a typical customer spends per purchase."),
    ("LTV", ["lifetime value", "CLV"], 1, "The total revenue expected from a customer across the whole relationship."),
    ("CAC", ["customer acquisition cost"], 1, "The total sales and marketing spend required to acquire one new customer."),
    ("conversion rate", [], 1, "The share of visitors who complete a target action, usually a purchase."),
    ("cart abandonment", [], 2, "When a shopper adds items then leaves without buying. Tracked as a percentage of carts created."),
    ("SKU", ["stock keeping unit"], 1, "A unique identifier for one distinct sellable item, including its size and colour variant."),
    ("GTIN", ["UPC", "EAN"], 2, "A global trade item number identifying a product across retailers. Required for many shopping feeds."),
    ("product feed", ["merchant feed"], 2, "A structured file of catalog data submitted to shopping channels so they can list your items."),
    ("PDP", ["product detail page"], 1, "The page for a single product, carrying its description, images, price, and availability."),
    ("PLP", ["product listing page", "category page"], 1, "A page listing multiple products, usually filterable and paginated."),
    ("variant", [], 2, "A version of a product differing by one attribute such as size or colour. A frequent duplicate-content source."),
    ("Product schema", [], 2, "Structured data describing an item's price, availability, and reviews, enabling enriched shopping results."),
    ("out of stock", [], 2, "An unavailable item. How you handle the page matters: keeping and updating it usually beats removing it."),
    ("merchandising", [], 2, "Deciding which products surface where, in what order, to steer discovery and margin."),
    ("marketplace", [], 2, "A platform selling third-party inventory alongside or instead of its own."),
    ("dropshipping", [], 2, "Selling goods fulfilled directly by a supplier, so the retailer never holds stock."),
    ("returns rate", [], 1, "The share of orders sent back. A direct drag on contribution margin."),
    ("basket analysis", ["market basket analysis"], 2, "Studying which products are bought together to inform bundling and recommendations."),
    ("subscription commerce", [], 2, "Selling on a recurring schedule rather than one purchase at a time."),
    ("BOPIS", ["buy online pick up in store"], 2, "Ordering online and collecting in a physical location."),
    ("UCP", ["Universal Commerce Protocol"], 2, "Standardizes commerce capabilities so agents can discover products and complete purchases across platforms."),
    ("agentic commerce", [], 2, "Purchases initiated and completed by an AI agent on a shopper's behalf."),
    ("price parity", [], 2, "Keeping a product's price consistent across the channels you sell on."),
    ("category taxonomy", [], 2, "The hierarchy products are organized into. Drives both navigation and crawl efficiency."),
    ("review schema", [], 2, "Structured data exposing ratings and reviews, commonly rendered as stars in results."),
])

PACKS["saas"] = dict(
    name="SaaS and developer tools",
    note="Subscription software, APIs, and technical products.",
    terms=[
    ("ARR", ["annual recurring revenue"], 1, "Contracted subscription revenue normalized to a yearly figure."),
    ("MRR", ["monthly recurring revenue"], 1, "Contracted subscription revenue normalized to a monthly figure."),
    ("churn", ["churn rate"], 1, "The share of customers or revenue lost in a period."),
    ("net revenue retention", ["NRR"], 2, "Revenue from existing customers this period versus last, including expansion and churn. Above 100% means growth without new logos."),
    ("PQL", ["product qualified lead"], 2, "A user whose product usage signals readiness to buy, as opposed to one who filled in a form."),
    ("product-led growth", ["PLG"], 2, "Acquiring and expanding customers through the product itself rather than through a sales motion."),
    ("free trial", [], 2, "Time-limited full access used to demonstrate value before purchase."),
    ("freemium", [], 2, "A permanently free tier with paid upgrades, as distinct from a time-limited trial."),
    ("activation", [], 2, "The point where a new user first reaches meaningful value. The metric that most predicts retention."),
    ("time to value", ["TTV"], 2, "How long it takes a new user to reach that first meaningful outcome."),
    ("API", ["application programming interface"], 1, "A defined contract letting one system call another programmatically."),
    ("REST", [], 1, "An API style using standard HTTP verbs against resource URLs."),
    ("GraphQL", [], 1, "A query language letting a client request exactly the fields it needs in one round trip."),
    ("webhook", [], 2, "An outbound HTTP callback fired when an event occurs, so consumers do not have to poll."),
    ("rate limit", [], 2, "A cap on how many requests a client may make in a window."),
    ("SDK", ["software development kit"], 1, "A language-specific library wrapping an API so developers do not hand-roll requests."),
    ("SSO", ["single sign-on"], 2, "Authenticating once against an identity provider to access multiple applications."),
    ("SOC 2", [], 2, "An audit report on security and availability controls. Frequently required in enterprise procurement."),
    ("uptime SLA", [], 2, "A contractual availability commitment, usually with credits owed when it is missed."),
    ("documentation site", ["docs"], 2, "The reference and guide content developers rely on. Often a product's highest-intent organic traffic."),
    ("changelog", [], 2, "A dated record of releases and changes."),
    ("self-serve", [], 2, "A purchase path a customer completes without talking to sales."),
    ("expansion revenue", [], 2, "Additional revenue from existing customers through upgrades, seats, or usage."),
    ("usage-based pricing", [], 2, "Charging by consumption rather than a flat seat fee."),
    ("developer experience", ["DX"], 2, "How easily a developer can adopt and succeed with a tool. A genuine differentiator in this category."),
])

PACKS["finance"] = dict(
    name="Financial services",
    note="General industry vocabulary. Not financial advice, and not a substitute for compliance review.",
    terms=[
    ("APR", ["annual percentage rate"], 1, "The yearly cost of borrowing including interest and most fees, expressed as a percentage."),
    ("APY", ["annual percentage yield"], 1, "The yearly return on savings including compounding. Distinct from a simple interest rate."),
    ("basis point", ["bps"], 1, "One hundredth of a percentage point. Fifty basis points is half a percent."),
    ("underwriting", [], 2, "Assessing the risk of a loan or policy and deciding the terms on which to accept it."),
    ("credit score", [], 2, "A model output summarizing credit risk from a borrower's history."),
    ("LTV ratio", ["loan-to-value"], 2, "The loan amount divided by the value of the asset securing it."),
    ("DTI", ["debt-to-income"], 2, "Monthly debt payments divided by gross monthly income. A common lending threshold."),
    ("escrow", [], 2, "Funds held by a third party until the conditions of an agreement are met."),
    ("amortization", [], 2, "Paying down a balance through scheduled payments that cover both interest and principal."),
    ("refinance", [], 2, "Replacing an existing loan with a new one, usually for different rate or term."),
    ("KYC", ["know your customer"], 2, "Regulated identity verification performed before opening an account."),
    ("AML", ["anti-money laundering"], 2, "Controls and reporting designed to detect and prevent illicit funds moving through a business."),
    ("fiduciary", [], 2, "A party legally obliged to act in another's interest ahead of its own."),
    ("AUM", ["assets under management"], 1, "The total market value of assets a firm manages on behalf of clients."),
    ("expense ratio", [], 2, "The annual percentage of assets a fund charges to cover its operating costs."),
    ("liquidity", [], 2, "How quickly an asset can be converted to cash without materially moving its price."),
    ("diversification", [], 2, "Spreading exposure across assets so no single outcome dominates the result."),
    ("compliance", [], 2, "The function ensuring a business meets its regulatory and legal obligations."),
    ("open banking", [], 2, "Regulated sharing of bank data with third parties through APIs, at the customer's direction."),
    ("chargeback", [], 2, "A forced reversal of a card payment initiated by the cardholder's bank."),
    ("PCI DSS", [], 2, "The security standard governing how card data is stored, processed, and transmitted."),
    ("embedded finance", [], 2, "Financial products delivered inside a non-financial company's product experience."),
])

PACKS["healthcare"] = dict(
    name="Healthcare and life sciences",
    note="Industry and marketing vocabulary only. Contains no clinical guidance and must not be used for medical content without review.",
    terms=[
    ("HIPAA", [], 2, "The US law governing the privacy and security of protected health information."),
    ("PHI", ["protected health information"], 2, "Individually identifiable health data covered by HIPAA."),
    ("EHR", ["electronic health record", "EMR"], 2, "The digital record of a patient's care held by a provider organization."),
    ("payer", [], 2, "The organization that pays for care, typically an insurer or government program."),
    ("provider", [], 2, "The organization or clinician delivering care."),
    ("prior authorization", [], 2, "Approval a payer requires before it will cover a service or medication."),
    ("CPT code", [], 2, "A standardized code identifying a medical procedure for billing purposes."),
    ("ICD-10", [], 2, "The international classification system used to code diagnoses."),
    ("telehealth", [], 2, "Delivering care remotely by video, phone, or asynchronous messaging."),
    ("interoperability", [], 2, "The ability of health systems to exchange data and use what they receive."),
    ("FHIR", [], 2, "A standard for exchanging healthcare data over web APIs."),
    ("value-based care", [], 2, "Reimbursement tied to patient outcomes rather than volume of services delivered."),
    ("patient acquisition", [], 2, "The marketing function bringing new patients to a practice or health system."),
    ("YMYL", [], 2, "Your Money or Your Life. Google's designation for topics where inaccuracy could cause real harm, held to a higher quality bar."),
    ("medical review", [], 2, "Having a qualified clinician verify health content before publication. Expected practice for YMYL pages."),
    ("clinical trial", [], 2, "A structured study evaluating an intervention in human participants."),
    ("FDA clearance", [], 2, "A regulatory pathway permitting a device to be marketed in the US. Distinct from approval."),
    ("CMS", [], 2, "The US agency administering Medicare and Medicaid."),
    ("population health", [], 2, "Managing outcomes across a defined group rather than one patient at a time."),
    ("care gap", [], 2, "A difference between recommended care and the care a patient has actually received."),
])

PACKS["real-estate"] = dict(
    name="Real estate and property",
    note="Residential and commercial property vocabulary.",
    terms=[
    ("MLS", ["multiple listing service"], 2, "The shared database brokers use to list and search properties in a market."),
    ("comps", ["comparables"], 2, "Recently sold similar properties used to estimate what a home is worth."),
    ("cap rate", ["capitalization rate"], 2, "Net operating income divided by property value. A yield measure for income property."),
    ("NOI", ["net operating income"], 1, "Rental income less operating expenses, before debt service and taxes."),
    ("escrow", [], 2, "Funds or documents held by a neutral third party until closing conditions are met."),
    ("title insurance", [], 2, "Coverage protecting against defects in a property's ownership history."),
    ("appraisal", [], 2, "A licensed valuation of a property, usually required by a lender."),
    ("closing costs", [], 2, "Fees paid at completion, covering lending, title, and transfer charges."),
    ("HOA", ["homeowners association"], 2, "The body governing shared areas and rules in a community, funded by member dues."),
    ("zoning", [], 2, "Local rules dictating how a parcel of land may be used and what may be built on it."),
    ("absorption rate", [], 2, "How quickly available inventory sells in a market, usually expressed in months of supply."),
    ("days on market", ["DOM"], 1, "How long a listing has been active before going under contract."),
    ("under contract", [], 2, "An accepted offer with conditions still outstanding, so the sale is not yet complete."),
    ("1031 exchange", [], 2, "A US provision deferring capital gains tax when sale proceeds are reinvested in like-kind property."),
    ("triple net lease", ["NNN"], 2, "A commercial lease where the tenant pays taxes, insurance, and maintenance on top of rent."),
    ("iBuyer", [], 2, "A company making algorithmic instant cash offers on homes."),
    ("local pack", [], 2, "The map-plus-three-listings block in local search results. The primary organic target for agents."),
    ("Google Business Profile", ["GBP"], 2, "The listing controlling how a business appears in maps and local results."),
    ("IDX", [], 2, "The framework letting brokers publish MLS listings on their own websites."),
    ("pocket listing", [], 2, "A property marketed privately rather than through the MLS."),
])




# Expansion is display context, not a matching alias. These full forms are
# almost never written out in body copy, so they must not become match targets.
EXPLICIT_EXPANSION = {
    "GTIN": "Global Trade Item Number",
    "PCI DSS": "Payment Card Industry Data Security Standard",
    "HIPAA": "Health Insurance Portability and Accountability Act",
    "ICD-10": "International Classification of Diseases, 10th revision",
    "FHIR": "Fast Healthcare Interoperability Resources",
    "YMYL": "Your Money or Your Life",
    "CMS": "Centers for Medicare and Medicaid Services",
    "IDX": "Internet Data Exchange",
    "REST": "Representational State Transfer",
    "SOC 2": "System and Organization Controls, Type 2",
    "JSON-LD": "JavaScript Object Notation for Linked Data",
    "E-E-A-T": "Experience, Expertise, Authoritativeness, Trust",
    "SKU": "Stock keeping unit",
    "MCP": "Model Context Protocol",
    "UCP": "Universal Commerce Protocol",
    "RAG": "Retrieval-augmented generation",
    "GEO": "Generative engine optimization",
    "SEO": "Search engine optimization",
    "API": "Application programming interface",
    "SDK": "Software development kit",
    "SSO": "Single sign-on",
    "LCP": "Largest Contentful Paint",
    "CLS": "Cumulative Layout Shift",
    "INP": "Interaction to Next Paint",
    "PDP": "Product detail page",
    "PLP": "Product listing page",
    "AOV": "Average order value",
    "CAC": "Customer acquisition cost",
    "LTV": "Lifetime value",
    "KYC": "Know your customer",
    "AML": "Anti-money laundering",
    "AUM": "Assets under management",
    "APR": "Annual percentage rate",
    "APY": "Annual percentage yield",
    "DTI": "Debt-to-income ratio",
    "MLS": "Multiple listing service",
    "NOI": "Net operating income",
    "HOA": "Homeowners association",
    "DOM": "Days on market",
    "NNN": "Triple net lease",
    "ARR": "Annual recurring revenue",
    "MRR": "Monthly recurring revenue",
    "PQL": "Product qualified lead",
    "PLG": "Product-led growth",
    "NRR": "Net revenue retention",
    "TTV": "Time to value",
    "DX": "Developer experience",
    "BOPIS": "Buy online, pick up in store",
    "EHR": "Electronic health record",
    "PHI": "Protected health information",
    "CPT code": "Current Procedural Terminology code",
    "SERP": "Search engine results page",
    "CTR": "Click-through rate",
    "GBP": "Google Business Profile",
    "MEDDIC": "Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion",
    "1031 exchange": "Section 1031 like-kind exchange",
}

ACRONYMISH = lambda w: (w.isupper() and len(w) >= 2) or (w.count(".") and w.isupper())

def expansion_of(name, alts):
    """The first alias is the written-out form only when it is genuinely an
    expansion: multi-word, and the term itself reads as an acronym. Sibling
    acronyms (GTIN -> UPC, EAN) and plain synonyms are excluded."""
    if name in EXPLICIT_EXPANSION:
        return EXPLICIT_EXPANSION[name]
    if not alts:
        return None
    letters = [c for c in name if c.isalpha()]
    if not letters or not name.replace("-", "").replace(".", "").isupper():
        return None
    first = alts[0]
    if " " not in first and "-" not in first:
        return None
    return first[0].upper() + first[1:]

def build(pid, spec):
    terms = []
    for name, alts, tier, desc in spec["terms"]:
        t = {"@type": "DefinedTerm", "name": name, "termCode": "T%d" % tier, "description": desc}
        if alts:
            t["alternateName"] = alts
        exp = expansion_of(name, alts)
        if exp:
            t["ctx"] = {"expansion": exp}
        terms.append(t)
    body = {
        "@context": "https://schema.org",
        "@type": "DefinedTermSet",
        "@id": "https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@latest/packs/%s.json" % pid,
        "identifier": pid,
        "name": spec["name"],
        "description": spec["note"],
        "dateModified": TODAY,
        "inLanguage": "en",
        "hasDefinedTerm": terms,
    }
    raw = json.dumps(body, indent=2, ensure_ascii=False)
    body["version"] = hashlib.sha1(raw.encode()).hexdigest()[:8]
    raw = json.dumps(body, indent=2, ensure_ascii=False)
    open(os.path.join(OUT, pid + ".json"), "w").write(raw)
    return pid, len(terms), body["version"], len(raw)


index = []
for pid, spec in PACKS.items():
    pid_, n, v, size = build(pid, spec)
    index.append({"id": pid_, "name": spec["name"], "terms": n, "version": v,
                  "bytes": size, "note": spec["note"]})
    print("%-14s %3d terms  v%s  %5.1f KB" % (pid_, n, v, size / 1024))

open(os.path.join(OUT, "index.json"), "w").write(json.dumps(
    {"generated": TODAY, "packs": index}, indent=2))
print("\ntotal", sum(p["terms"] for p in index), "terms across", len(index), "packs")
