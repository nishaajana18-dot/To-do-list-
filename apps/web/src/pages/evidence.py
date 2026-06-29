import streamlit as st

from apps.web.src.utils.api_client import list_sources, get_claims, list_evidence


def render():
    st.title("Evidence Browser")
    st.markdown("Browse extracted evidence from your uploaded sources.")

    project_id = st.session_state.get("project_id")
    if not project_id:
        st.warning("Please create or select a project first.")
        return

    tab_sources, tab_claims, tab_all = st.tabs(["Sources", "Claims by Source", "All Evidence"])

    with tab_sources:
        render_sources(project_id)

    with tab_claims:
        render_claims_by_source(project_id)

    with tab_all:
        render_all_evidence(project_id)


def render_sources(project_id: str):
    try:
        sources = list_sources(project_id)
    except Exception as e:
        st.warning(f"Cannot connect: {e}")
        return

    if not sources:
        st.info("No sources uploaded yet.")
        return

    for s in sources:
        with st.expander(f"{s['source_name']} ({s['source_type']})"):
            st.json(
                {
                    "id": s["id"],
                    "type": s["source_type"],
                    "status": s["extraction_status"],
                    "uploaded": s["upload_timestamp"],
                    "confidence": s.get("confidence"),
                }
            )
            if s.get("extracted_text"):
                st.text_area("Extracted Text", s["extracted_text"][:2000], height=200)
            if s.get("tables"):
                st.write("Tables found:", len(s["tables"]))


def render_claims_by_source(project_id: str):
    try:
        sources = list_sources(project_id)
    except Exception as e:
        st.warning(f"Cannot connect: {e}")
        return

    source_id = st.selectbox(
        "Select source",
        options=[s["id"] for s in sources],
        format_func=lambda sid: next((s["source_name"] for s in sources if s["id"] == sid), sid),
    )

    if source_id:
        try:
            claims = get_claims(source_id)
        except Exception as e:
            st.warning(f"Cannot fetch claims: {e}")
            return

        if not claims:
            st.info("No claims extracted yet. Run ingestion first.")
            return

        st.write(f"**{len(claims)} claims extracted**")
        for c in claims:
            with st.container(border=True):
                st.markdown(f"**{c['claim_type']}** (confidence: {c['confidence']})")
                st.text(c["text"][:500])
                if c.get("variables"):
                    st.caption(f"Variables: {', '.join(c['variables'])}")
                if c.get("conditions"):
                    st.caption(f"Conditions: {', '.join(c['conditions'])}")


def render_all_evidence(project_id: str):
    col1, col2 = st.columns(2)
    with col1:
        claim_type = st.selectbox("Filter by type", ["All", "result", "method", "hypothesis", "limitation", "general"])
    with col2:
        min_conf = st.slider("Min confidence", 0.0, 1.0, 0.0)

    try:
        evidence = list_evidence(
            project_id,
            claim_type=None if claim_type == "All" else claim_type,
            min_confidence=min_conf,
        )
    except Exception as e:
        st.warning(f"Cannot fetch evidence: {e}")
        return

    if not evidence:
        st.info("No evidence found.")
        return

    st.write(f"**{len(evidence)} items**")
    for ev in evidence:
        with st.container(border=True):
            cols = st.columns([3, 1, 1])
            with cols[0]:
                st.text(ev["text"][:300])
            with cols[1]:
                st.caption(f"Conf: {ev['confidence']}")
            with cols[2]:
                st.caption(ev["source_type"])
