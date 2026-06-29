import streamlit as st

from apps.web.src.utils.api_client import (
    generate_hypotheses,
    list_hypotheses,
    get_hypothesis,
    update_hypothesis,
)
from packages.core.src.schemas import HypothesisStatus


def render():
    st.title("Hypotheses & Review")
    st.markdown("Generate and review candidate hypotheses based on your evidence.")

    project_id = st.session_state.get("project_id")
    if not project_id:
        st.warning("Please create or select a project first.")
        return

    col1, col2 = st.columns([3, 1])
    with col1:
        st.markdown(f"Project: **{st.session_state.get('project_title', 'N/A')}**")
    with col2:
        if st.button("Generate Hypotheses", type="primary", use_container_width=True):
            with st.spinner("Analyzing evidence and detecting gaps..."):
                try:
                    results = generate_hypotheses(project_id)
                    st.success(f"Generated {len(results)} hypotheses")
                    st.rerun()
                except Exception as e:
                    st.error(f"Generation failed: {e}")

    status_filter = st.selectbox("Filter by status", ["All", "draft", "reviewed", "accepted", "rejected"])

    try:
        hypotheses = list_hypotheses(
            project_id,
            status_filter=None if status_filter == "All" else status_filter,
        )
    except Exception as e:
        st.warning(f"Cannot fetch hypotheses: {e}")
        return

    if not hypotheses:
        st.info("No hypotheses yet. Click 'Generate Hypotheses' above.")
        return

    st.write(f"**{len(hypotheses)} hypotheses**")

    for h in hypotheses:
        render_hypothesis_card(h)

    render_hypothesis_detail(project_id)


def render_hypothesis_card(h: dict):
    with st.expander(f"{h['title']}  (confidence: {h.get('confidence_score', 'N/A')})"):
        cols = st.columns([2, 1, 1, 1])
        with cols[0]:
            st.markdown(f"**Research Question:** {h['research_question']}")
            st.markdown(f"**Hypothesis:** {h['hypothesis']}")
        with cols[1]:
            st.metric("Confidence", h.get("confidence_score", "N/A"))
        with cols[2]:
            st.metric("Novelty", h.get("novelty_score", "N/A"))
        with cols[3]:
            st.metric("Testability", h.get("testability_score", "N/A"))

        if h.get("mechanism"):
            st.markdown(f"**Proposed Mechanism:** {h['mechanism']}")
        if h.get("proposed_experiment"):
            st.markdown(f"**Proposed Experiment:** {h['proposed_experiment']}")
        if h.get("falsification_criteria"):
            st.markdown(f"**Falsification Criteria:** {h['falsification_criteria']}")

        if h.get("supporting_evidence"):
            with st.container(border=True):
                st.markdown("**Supporting Evidence**")
                for ev in h["supporting_evidence"][:3]:
                    st.text(f"- {ev.get('text', '')[:200]}")

        if h.get("conflicting_evidence"):
            with st.container(border=True):
                st.markdown("**Conflicting Evidence**")
                for ev in h["conflicting_evidence"][:3]:
                    st.text(f"- {ev.get('text', '')[:200]}")

        if h.get("assumptions"):
            st.markdown("**Assumptions**")
            for a in h["assumptions"]:
                st.markdown(f"- {a}")

        if h.get("notes_for_human_review"):
            st.caption(f"Note: {h['notes_for_human_review']}")

        st.caption(f"Status: {h['status']} | ID: {h['id'][:8]}...")


def render_hypothesis_detail(project_id: str):
    st.divider()
    st.subheader("Review & Edit Hypothesis")

    try:
        hypotheses = list_hypotheses(project_id)
    except Exception:
        return

    if not hypotheses:
        return

    selected_id = st.selectbox(
        "Select hypothesis to edit",
        options=[h["id"] for h in hypotheses],
        format_func=lambda hid: next(
            (f"{h['title'][:50]}..." for h in hypotheses if h["id"] == hid), hid
        ),
    )

    if selected_id:
        try:
            h = get_hypothesis(selected_id)
        except Exception as e:
            st.error(f"Cannot fetch hypothesis: {e}")
            return

        with st.form(f"edit_{h['id']}"):
            title = st.text_input("Title", value=h.get("title", ""))
            question = st.text_area("Research Question", value=h.get("research_question", ""), height=80)
            hypothesis = st.text_area("Hypothesis", value=h.get("hypothesis", ""), height=100)
            mechanism = st.text_area("Mechanism", value=h.get("mechanism", "") or "", height=80)
            experiment = st.text_area("Proposed Experiment", value=h.get("proposed_experiment", "") or "", height=80)
            prediction = st.text_area("Predicted Outcome", value=h.get("predicted_outcome", "") or "", height=60)
            falsification = st.text_area("Falsification Criteria", value=h.get("falsification_criteria", "") or "", height=60)
            notes = st.text_area("Notes for Review", value=h.get("notes_for_human_review", "") or "", height=60)

            status = st.selectbox(
                "Status",
                options=[s.value for s in HypothesisStatus],
                index=[s.value for s in HypothesisStatus].index(h.get("status", "draft")),
            )

            submitted = st.form_submit_button("Save Changes", type="primary", use_container_width=True)
            if submitted:
                try:
                    update_hypothesis(
                        h["id"],
                        {
                            "title": title,
                            "research_question": question,
                            "hypothesis": hypothesis,
                            "mechanism": mechanism if mechanism else None,
                            "proposed_experiment": experiment if experiment else None,
                            "predicted_outcome": prediction if prediction else None,
                            "falsification_criteria": falsification if falsification else None,
                            "notes_for_human_review": notes if notes else None,
                            "status": status,
                        },
                    )
                    st.success("Hypothesis updated!")
                    st.rerun()
                except Exception as e:
                    st.error(f"Update failed: {e}")
