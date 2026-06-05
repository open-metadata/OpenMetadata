import streamlit as st
import pandas as pd
from config import TAG_ZOMBIE, OM_URL
from client import get_headers
import requests

st.set_page_config(page_title="FinOps Cloud Waste Assassin", layout="centered")
st.title("Cloud Waste Assassin")
st.subheader("Autonomous FinOps Agent MVP")

st.markdown("This dashboard tracks unutilized tables tagged as **Zombies** by our FinOps Agent.")

def fetch_zombie_tables():
    """Fetch ONLY tables with FinOps.Zombie tag via OpenMetadata Search API/Query with pagination."""
    url = f"{OM_URL}/search/query"
    zombies = []
    from_param = 0
    size = 100

    while True:
        params = {
            "q": f'tags.tagFQN:"{TAG_ZOMBIE}"',
            "index": "table_search_index",
            "from": from_param,
            "size": size
        }
        try:
            res = requests.get(url, headers=get_headers(), params=params, timeout=10)
            res.raise_for_status()
            hits = res.json().get("hits", {}).get("hits", [])
            if not hits:
                break
            zombies.extend([hit["_source"] for hit in hits])
            from_param += size
        except Exception as e:
            st.error(f"Failed to fetch from search API: {e}")
            break

    return zombies

if st.button("Refresh OpenMetadata Data"):
    with st.spinner("Fetching Zombie Tables..."):
        zombies = fetch_zombie_tables()

    col1, col2 = st.columns(2)
    col1.metric("Zombies Eliminated", len(zombies))

    # Compute savings based strictly on the custom property or fallback to description parse
    total_savings = 0.0
    data = []
    for z in zombies:
        # Try to get from custom properties
        waste = 0.0
        ext = z.get("extension", {})
        if ext and "monthlyWasteUSD" in ext:
            try:
                waste = float(ext["monthlyWasteUSD"])
            except ValueError:
                waste = 50.0
        else:
            # Fallback: extract from description
            desc = z.get("description", "")
            if "Estimated Waste: $" in desc:
                try:
                    waste_str = desc.split("Estimated Waste: $")[1].split("/mo")[0]
                    waste = float(waste_str)
                except Exception:
                    waste = 50.0 # Config fallback
            else:
                waste = 50.0
                
        total_savings += waste
        
        data.append({
            "Table Name": z.get("name"),
            "Database": z.get("database", {}).get("name", "Unknown"),
            "Waste (USD/mo)": f"${waste:.2f}",
            "FQN": z.get("fullyQualifiedName")
        })

    col2.metric("Estimated Savings/mo", f"${total_savings:.2f}")

    if zombies:
        st.divider()
        st.markdown("### Flagged Zombie Tables")
        st.dataframe(pd.DataFrame(data), use_container_width=True)
    else:
        st.success("No zombie tables found! Cloud waste is optimal.")
