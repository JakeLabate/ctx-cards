"""Build the vertical term packs.

Reads term data from scripts/terms/*.py and emits one JSON-LD DefinedTermSet
per pack, plus an index. Fails loudly on the mistakes that actually happen at
scale: duplicate terms inside a pack, acronyms missing their expansion, and
cross-vertical collisions where one term means different things in two packs.
"""

import json, os, sys, hashlib

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "packs")
sys.path.insert(0, HERE)

from terms.core import SEO_CORE, AGENTIC
from terms.commerce import ECOMMERCE, SAAS
from terms.regulated import FINANCE, HEALTHCARE, LEGAL, INSURANCE
from terms.verticals import (REAL_ESTATE, HOME_SERVICES, MANUFACTURING,
                             HOSPITALITY, EDUCATION, AUTOMOTIVE)

TODAY = "2026-08-29"
CDN = "https://cdn.jsdelivr.net/gh/JakeLabate/ctx-cards@latest/packs"

PACKS = [
    ("seo-core", "Search and content marketing",
     "Universal pack. Load this on every site.", SEO_CORE),
    ("agentic-ai", "Agentic AI protocols",
     "Protocols and vocabulary for AI agents consuming the web.", AGENTIC),
    ("ecommerce", "Ecommerce and retail",
     "Marketplace, DTC, and retail catalog sites.", ECOMMERCE),
    ("saas", "SaaS and developer tools",
     "Subscription software, APIs, and technical products.", SAAS),
    ("finance", "Financial services",
     "Industry vocabulary only. Not financial advice, and not a substitute for compliance review.", FINANCE),
    ("healthcare", "Healthcare and life sciences",
     "Industry and marketing vocabulary only. Contains no clinical guidance and must not be used for medical content without qualified review.", HEALTHCARE),
    ("legal", "Legal and compliance",
     "Industry vocabulary only. Not legal advice.", LEGAL),
    ("insurance", "Insurance",
     "Industry vocabulary only. Not coverage advice.", INSURANCE),
    ("real-estate", "Real estate and property",
     "Residential and commercial property.", REAL_ESTATE),
    ("home-services", "Home and field services",
     "Trades, local service businesses, and field operations.", HOME_SERVICES),
    ("manufacturing", "Manufacturing and industrial",
     "Production, supply chain, and industrial B2B.", MANUFACTURING),
    ("hospitality", "Hospitality and travel",
     "Hotels, restaurants, and travel operators.", HOSPITALITY),
    ("education", "Education",
     "Higher education, K-12, and workforce training.", EDUCATION),
    ("automotive", "Automotive",
     "Dealerships, service, and vehicle retail.", AUTOMOTIVE),
]

# Expansion is display context, not a matching alias. Full forms that never
# appear in body copy belong here, so they render on the card without becoming
# match targets. Auto-detection from the first alias handles the rest.
EXPANSIONS = {
    "SEO": "Search engine optimization", "SERP": "Search engine results page",
    "CTR": "Click-through rate", "GEO": "Generative engine optimization",
    "AEO": "Answer engine optimization", "RAG": "Retrieval-augmented generation",
    "JSON-LD": "JavaScript Object Notation for Linked Data",
    "E-E-A-T": "Experience, Expertise, Authoritativeness, Trust",
    "YMYL": "Your Money or Your Life", "CWV": "Core Web Vitals",
    "LCP": "Largest Contentful Paint", "CLS": "Cumulative Layout Shift",
    "INP": "Interaction to Next Paint", "TTFB": "Time to first byte",
    "CSR": "Client-side rendering", "SSR": "Server-side rendering",
    "SSG": "Static site generation", "GSC": "Google Search Console",
    "GA4": "Google Analytics 4", "DA": "Domain authority",
    "PAA": "People Also Ask", "CrUX": "Chrome User Experience Report",
    "MCP": "Model Context Protocol", "UCP": "Universal Commerce Protocol",
    "A2A": "Agent-to-Agent protocol", "AP2": "Agent Payments Protocol",
    "ACP": "Agent Commerce Protocol", "NLWeb": "Natural Language Web",
    "HITL": "Human in the loop", "WebMCP": "Web Model Context Protocol",
    "AOV": "Average order value", "LTV": "Lifetime value",
    "CAC": "Customer acquisition cost", "ROAS": "Return on ad spend",
    "GMV": "Gross merchandise value", "SKU": "Stock keeping unit",
    "GTIN": "Global Trade Item Number", "MPN": "Manufacturer part number",
    "PIM": "Product information management", "PDP": "Product detail page",
    "PLP": "Product listing page", "UGC": "User generated content",
    "3PL": "Third-party logistics", "BOPIS": "Buy online, pick up in store",
    "MAP": "Minimum advertised price", "BNPL": "Buy now, pay later",
    "ARR": "Annual recurring revenue", "MRR": "Monthly recurring revenue",
    "NRR": "Net revenue retention", "GRR": "Gross revenue retention",
    "PQL": "Product qualified lead", "MQL": "Marketing qualified lead",
    "SQL": "Sales qualified lead", "PLG": "Product-led growth",
    "TTV": "Time to value", "DX": "Developer experience",
    "API": "Application programming interface", "SDK": "Software development kit",
    "REST": "Representational State Transfer", "SSO": "Single sign-on",
    "SCIM": "System for Cross-domain Identity Management",
    "SOC 2": "System and Organization Controls, Type 2",
    "APR": "Annual percentage rate", "APY": "Annual percentage yield",
    "DTI": "Debt-to-income ratio", "AUM": "Assets under management",
    "KYC": "Know your customer", "AML": "Anti-money laundering",
    "PCI DSS": "Payment Card Industry Data Security Standard",
    "ACH": "Automated Clearing House", "ETF": "Exchange-traded fund",
    "EBITDA": "Earnings before interest, tax, depreciation, and amortization",
    "AR": "Accounts receivable", "Reg BI": "Regulation Best Interest",
    "HIPAA": "Health Insurance Portability and Accountability Act",
    "PHI": "Protected health information", "BAA": "Business associate agreement",
    "EHR": "Electronic health record",
    "FHIR": "Fast Healthcare Interoperability Resources",
    "HL7": "Health Level Seven",
    "ICD-10": "International Classification of Diseases, 10th revision",
    "CPT code": "Current Procedural Terminology code",
    "NPI": "National provider identifier", "HIE": "Health information exchange",
    "CMS": "Centers for Medicare and Medicaid Services",
    "RCM": "Revenue cycle management", "SDOH": "Social determinants of health",
    "IRB": "Institutional review board",
    "NDA": "Non-disclosure agreement", "MSA": "Master services agreement",
    "SOW": "Statement of work", "DPA": "Data processing agreement",
    "SLA": "Service level agreement", "LLC": "Limited liability company",
    "IP": "Intellectual property", "GDPR": "General Data Protection Regulation",
    "CCPA": "California Consumer Privacy Act",
    "DSAR": "Data subject access request",
    "ACV": "Actual cash value", "EOB": "Explanation of benefits",
    "MLS": "Multiple listing service", "IDX": "Internet data exchange",
    "CMA": "Comparative market analysis", "DOM": "Days on market",
    "NOI": "Net operating income", "DSCR": "Debt service coverage ratio",
    "NNN": "Triple net lease", "TI": "Tenant improvement",
    "HOA": "Homeowners association", "PMI": "Private mortgage insurance",
    "GBP": "Google Business Profile", "NAP": "Name, address, phone",
    "SAB": "Service area business", "LSA": "Local Services Ads",
    "CPL": "Cost per lead", "FSM": "Field service management",
    "HVAC": "Heating, ventilation, and air conditioning",
    "SEER": "Seasonal energy efficiency ratio",
    "OEM": "Original equipment manufacturer",
    "ODM": "Original design manufacturer",
    "BOM": "Bill of materials", "MOQ": "Minimum order quantity",
    "OEE": "Overall equipment effectiveness",
    "GD&T": "Geometric dimensioning and tolerancing",
    "CNC": "Computer numerical control", "CAD": "Computer-aided design",
    "CAM": "Computer-aided manufacturing", "JIT": "Just in time",
    "MRP": "Material requirements planning",
    "ERP": "Enterprise resource planning",
    "MES": "Manufacturing execution system",
    "SCADA": "Supervisory control and data acquisition",
    "PLC": "Programmable logic controller", "RFQ": "Request for quote",
    "NPI ": "New product introduction",
    "ADR": "Average daily rate", "RevPAR": "Revenue per available room",
    "TRevPAR": "Total revenue per available room",
    "GOPPAR": "Gross operating profit per available room",
    "LOS": "Length of stay", "OTA": "Online travel agency",
    "PMS": "Property management system", "CRS": "Central reservation system",
    "GDS": "Global distribution system",
    "MICE": "Meetings, incentives, conferences, and exhibitions",
    "F&B": "Food and beverage", "RevPASH": "Revenue per available seat hour",
    "GSS": "Guest satisfaction score",
    "LMS": "Learning management system", "SIS": "Student information system",
    "CBE": "Competency-based education", "CEU": "Continuing education unit",
    "FAFSA": "Free Application for Federal Student Aid",
    "FERPA": "Family Educational Rights and Privacy Act",
    "IPEDS": "Integrated Postsecondary Education Data System",
    "IEP": "Individualized education program",
    "VIN": "Vehicle identification number",
    "MSRP": "Manufacturer's suggested retail price",
    "F&I": "Finance and insurance", "CPO": "Certified pre-owned",
    "VDP": "Vehicle detail page", "SRP": "Search results page",
    "RO": "Repair order", "TSB": "Technical service bulletin",
    "EV": "Electric vehicle", "BEV": "Battery electric vehicle",
    "PHEV": "Plug-in hybrid electric vehicle", "kWh": "Kilowatt hour",
    "MPGe": "Miles per gallon equivalent",
    "ADAS": "Advanced driver assistance systems",
}


def expansion_of(name, alts):
    if name in EXPANSIONS:
        return EXPANSIONS[name]
    if not alts:
        return None
    core = name.replace("-", "").replace(".", "").replace(" ", "")
    if not core.isupper():
        return None
    first = alts[0]
    if " " not in first and "-" not in first:
        return None
    return first[0].upper() + first[1:]


def build(pid, name, note, rows):
    terms, seen = [], set()
    for term, alts, tier, desc in rows:
        key = term.lower()
        if key in seen:
            raise SystemExit(f"FAIL {pid}: duplicate term {term!r}")
        seen.add(key)
        if not desc.rstrip().endswith("."):
            raise SystemExit(f"FAIL {pid}: {term!r} definition does not end in a period")
        t = {"@type": "DefinedTerm", "name": term,
             "termCode": "T%d" % tier, "description": desc}
        if alts:
            t["alternateName"] = alts
        exp = expansion_of(term, alts)
        if exp:
            t["ctx"] = {"expansion": exp}
        terms.append(t)

    body = {"@context": "https://schema.org", "@type": "DefinedTermSet",
            "@id": f"{CDN}/{pid}.json", "identifier": pid, "name": name,
            "description": note, "dateModified": TODAY, "inLanguage": "en",
            "hasDefinedTerm": terms}
    body["version"] = hashlib.sha1(
        json.dumps(body, sort_keys=True).encode()).hexdigest()[:8]
    raw = json.dumps(body, indent=2, ensure_ascii=False)
    open(os.path.join(OUT, pid + ".json"), "w").write(raw)
    return terms, len(raw), body["version"]


def main():
    os.makedirs(OUT, exist_ok=True)
    index, owners, missing = [], {}, []
    total = 0

    for pid, name, note, rows in PACKS:
        terms, size, ver = build(pid, name, note, rows)
        total += len(terms)
        index.append({"id": pid, "name": name, "terms": len(terms),
                      "version": ver, "bytes": size, "note": note})
        print("%-15s %3d terms  v%s  %5.1f KB" % (pid, len(terms), ver, size / 1024))

        for t in terms:
            for n in [t["name"]] + t.get("alternateName", []):
                owners.setdefault(n.lower(), []).append(pid)
            core = t["name"].replace("-", "").replace(".", "").replace(" ", "")
            # a single letter plus digits is a tag or label (H1, EV is caught by
            # EXPANSIONS), not an initialism that needs writing out
            looks_acronym = (core.isupper() and 2 <= len(core) <= 6
                             and sum(c.isalpha() for c in core) >= 2)
            if looks_acronym and not t.get("ctx", {}).get("expansion"):
                missing.append(f"{pid}:{t['name']}")

    # A term meaning different things in two verticals is acceptable, but it has
    # to be a deliberate choice: precedence silently picks a winner otherwise.
    core_ids = {"seo-core", "agentic-ai"}
    # Terms that legitimately appear in two verticals with the SAME meaning.
    # Anything not listed here is a genuine divergence and fails the build.
    BENIGN = {
        "chargeback", "escrow", "underwriting", "in-network", "loyalty program",
        "seasonality", "gbp", "google business profile", "acv",
        "actual cash value", "citation",
    }
    clashes = {k: sorted(set(v)) for k, v in owners.items() if len(set(v)) > 1}
    cross = {k: v for k, v in clashes.items()
             if not (set(v) & core_ids) and k not in BENIGN}

    open(os.path.join(OUT, "index.json"), "w").write(json.dumps(
        {"generated": TODAY, "totalTerms": total, "packs": index}, indent=2))

    print(f"\n{total} terms across {len(index)} packs")
    if missing:
        raise SystemExit("FAIL acronyms without expansion: " + ", ".join(missing))
    if cross:
        print(f"\n{len(cross)} unresolved cross-vertical collisions:")
        for k, v in sorted(cross.items()):
            print("   %-26s %s" % (k, ", ".join(v)))
        raise SystemExit(
            "FAIL a term meaning different things in two packs must be renamed to "
            "disambiguate, or added to BENIGN if the meanings actually match.")
    print("\nvalidation passed")


if __name__ == "__main__":
    main()
