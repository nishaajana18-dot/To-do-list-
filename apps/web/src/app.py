import streamlit as st

st.set_page_config(
    page_title="AI Research Assistant",
    page_icon="",
    layout="wide",
    initial_sidebar_state="expanded",
)

from apps.web.src.pages import intake, uploads, evidence, hypotheses
from apps.web.src.utils.api_client import health_check

PAGES = {
    "Onboarding & Intake": intake,
    "Upload Files": uploads,
    "Evidence Browser": evidence,
    "Hypotheses & Review": hypotheses,
}


def main():
    st.sidebar.title("AI Research Assistant")
    st.sidebar.caption("From data to testable hypotheses")

    api_ok = health_check()
    st.sidebar.info("API Connected" if api_ok else "API Disconnected")

    if "project_id" not in st.session_state:
        st.session_state.project_id = None

    page = st.sidebar.radio("Navigation", list(PAGES.keys()), index=0)

    if st.session_state.project_id:
        st.sidebar.markdown("---")
        st.sidebar.markdown(f"**Project:** {st.session_state.get('project_title', 'N/A')}")
        st.sidebar.markdown(f"**ID:** `{st.session_state.project_id[:8]}...`")

    st.sidebar.markdown("---")
    st.sidebar.caption("v0.1.0 MVP")

    page_module = PAGES[page]
    page_module.render()


if __name__ == "__main__":
    main()
