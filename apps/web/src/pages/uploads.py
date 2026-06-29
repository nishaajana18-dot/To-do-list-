import os
import tempfile
from pathlib import Path

import streamlit as st

from apps.web.src.utils.api_client import upload_file, list_sources, ingest_source, ingest_all_sources


def render():
    st.title("Upload Files")

    project_id = st.session_state.get("project_id")
    if not project_id:
        st.warning("Please create or select a project first (Onboarding page).")
        return

    st.markdown(f"Project: **{st.session_state.get('project_title', 'N/A')}**")

    col1, col2 = st.columns([1, 1])

    with col1:
        render_upload_form(project_id)

    with col2:
        render_source_list(project_id)


def render_upload_form(project_id: str):
    st.subheader("Upload new file")

    uploaded_file = st.file_uploader(
        "Choose a file",
        type=["pdf", "csv", "xlsx", "xls", "txt", "md", "png", "jpg", "jpeg", "gif"],
        help="Supported: PDF, CSV, Excel, Text, Images",
    )

    if uploaded_file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(uploaded_file.name).suffix) as tmp:
            tmp.write(uploaded_file.getvalue())
            tmp_path = tmp.name

        if st.button("Upload", type="primary", use_container_width=True):
            try:
                result = upload_file(project_id, tmp_path)
                st.success(f"Uploaded: {result['source_name']}")
                st.rerun()
            except Exception as e:
                st.error(f"Upload failed: {e}")
            finally:
                os.unlink(tmp_path)

    st.divider()
    st.subheader("Bulk actions")
    if st.button("Ingest All Sources", use_container_width=True):
        try:
            result = ingest_all_sources(project_id)
            st.info(result["message"])
        except Exception as e:
            st.error(f"Ingestion trigger failed: {e}")


def render_source_list(project_id: str):
    st.subheader("Uploaded sources")

    try:
        sources = list_sources(project_id)
    except Exception as e:
        st.warning(f"Cannot fetch sources: {e}")
        return

    if not sources:
        st.info("No files uploaded yet.")
        return

    for s in sources:
        with st.container(border=True):
            cols = st.columns([3, 1, 1])
            with cols[0]:
                st.markdown(f"**{s['source_name']}**")
                st.caption(f"Type: {s['source_type']} | Status: {s['extraction_status']}")
            with cols[1]:
                if s["extraction_status"] == "pending":
                    if st.button("Ingest", key=f"ingest_{s['id']}"):
                        try:
                            ingest_source(s["id"])
                            st.rerun()
                        except Exception as e:
                            st.error(f"Ingestion failed: {e}")
            with cols[2]:
                if s["extraction_status"] == "completed":
                    st.markdown("Done")
                elif s["extraction_status"] == "failed":
                    st.markdown("Failed")
