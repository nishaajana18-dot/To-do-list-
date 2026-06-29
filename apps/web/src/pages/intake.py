import streamlit as st

from apps.web.src.utils.api_client import create_project, get_project, update_project, list_projects


def render():
    st.title("Project Intake")
    st.markdown("Define your research project to get started.")

    tab_new, tab_existing = st.tabs(["New Project", "Existing Projects"])

    with tab_new:
        render_new_project()

    with tab_existing:
        render_existing_projects()


def render_new_project():
    st.subheader("Create a new project")

    with st.form("intake_form"):
        title = st.text_input("Project Title", placeholder="e.g., Climate effects on pollinator behavior")
        branch = st.selectbox(
            "Branch of Science",
            [
                "",
                "Biology",
                "Chemistry",
                "Physics",
                "Computer Science",
                "Environmental Science",
                "Neuroscience",
                "Psychology",
                "Medicine",
                "Materials Science",
                "Engineering",
                "Other",
            ],
        )
        problem = st.text_area(
            "Research Problem",
            placeholder="Describe the problem you want to investigate...",
            height=100,
        )
        outcome = st.text_area(
            "Desired Outcome",
            placeholder="What would a successful result look like?",
            height=80,
        )
        constraints = st.text_area(
            "Experimental Constraints",
            placeholder="e.g., limited budget, available equipment, time frame, ethical considerations",
            height=80,
        )
        novelty = st.slider(
            "Novelty vs. Conservatism",
            min_value=0.0,
            max_value=1.0,
            value=0.5,
            help="0 = very conservative (build on well-established work), 1 = very novel (explore risky ideas)",
        )
        description = st.text_area(
            "Additional Notes",
            placeholder="Any other context...",
            height=80,
        )

        submitted = st.form_submit_button("Create Project", type="primary", use_container_width=True)

        if submitted:
            if not title.strip():
                st.error("Project title is required.")
                return

            payload = {
                "title": title.strip(),
                "branch_of_science": branch if branch else None,
                "research_problem": problem.strip() if problem.strip() else None,
                "desired_outcome": outcome.strip() if outcome.strip() else None,
                "experimental_constraints": constraints.strip() if constraints.strip() else None,
                "novelty_preference": novelty,
                "description": description.strip() if description.strip() else None,
            }

            try:
                project = create_project(payload)
                st.session_state.project_id = project["id"]
                st.session_state.project_title = project["title"]
                st.success(f"Project **{project['title']}** created!")
                st.rerun()
            except Exception as e:
                st.error(f"Failed to create project: {e}")


def render_existing_projects():
    try:
        projects = list_projects()
    except Exception as e:
        st.warning(f"Cannot connect to API: {e}")
        return

    if not projects:
        st.info("No projects yet. Create one in the tab above.")
        return

    for p in projects:
        with st.container(border=True):
            col1, col2, col3 = st.columns([3, 1, 1])
            with col1:
                st.markdown(f"**{p['title']}**")
                if p.get("branch_of_science"):
                    st.caption(f"Science: {p['branch_of_science']}")
                if p.get("research_problem"):
                    st.text(p["research_problem"][:200])
            with col2:
                st.caption(f"Created: {p['created_at'][:10]}")
            with col3:
                if st.button("Select", key=f"select_{p['id']}"):
                    st.session_state.project_id = p["id"]
                    st.session_state.project_title = p["title"]
                    st.rerun()
