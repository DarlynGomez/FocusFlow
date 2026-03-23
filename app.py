"""
This creates a basic Streamlit app layout containing:
- A "welcome" state (no document loaded)
- A "reading state (uses a sample document instead of real PDF parsing)
- A stable Streamlit session state (so the app doesn't break on reruns
    and states don't reset)
"""

# Imports
# UI framework being used
import streamlit as st
# For tracking timestamps
import time
from PIL import Image


page_icon = Image.open("assets/focusflow_icon.png")

# Set up how the Streamlit page looks in the browser
st.set_page_config(
    page_title="FocusFlow",
    page_icon=page_icon,
    layout="wide"
)

# Session state initialization
def init_session_state() -> None:
    """
    Initialize Streamlit session state variables by editing Streamlit's
    st.session_state dictionary to avoid getting KeyError's.

    This will check if each key exists and if not, create it with a 
    safe default value.
    """
    #keys/values for the session state
    defaults = {
        # Currently loaded document
        "document": None,
        # Chunk user is currently reading
        "current_chunk": 0,
        # Toggle for intervention prompt's visibility
        "show_intervention": False,
        # User settings
        "preferences": {
            # Seconds before a behaviour is considered a pause
            "intervention_threshold": 60
        },
        # Toggle for debugging
        "debug_mode": False
    }

    for key, value in defaults.items():
        # Set it if it does not already exist
        if key not in st.session_state:
            st.session_state[key] = value

init_session_state()

# Sample document generator
def get_sample_document() -> dict:
    """
    Teturn a simple fake document that matches our intended document
    model shape.

    This is for development purposes to build the UI before PDF parsing
    exists.
    """

    return {
        "id": "sample_doc_001",
        "filename": "sample_paper.pdf",
        "total_chunks": 3,
        "chunks": [
            {
                "id": "chunk_1",
                "index": 0,
                "title": "Introduction to Sleep and Memory",
                "key_idea": "Sleep plays a critical role in consolidating new memories.",
                "content": (
                    "This is sample content. In the real app, this would be extracted from a PDF.\n\n"
                    "Think of this as a placeholder that helps us build the reading experience first."
                ),
            },
            {
                "id": "chunk_2",
                "index": 1,
                "title": "REM Sleep and Learning",
                "key_idea": "REM sleep strengthens neural connections formed during learning.",
                "content": (
                    "More sample content.\n\n"
                    "Later, this will be chunked text (300–500 words) with formatting improvements."
                ),
            },
            {
                "id": "chunk_3",
                "index": 2,
                "title": "Implications for Students",
                "key_idea": "Prioritizing sleep may improve learning and retention.",
                "content": (
                    "Final sample chunk.\n\n"
                    "When you're ready, you'll replace this sample document with real PDF parsing output."
                ),
            },
        ],
    }

# Sidebar UI
def render_sidebar() -> None:
    """
    Render the Right sidebar containing upload controls, settings,
    debug toggles, etc.
    
    """

    # Renders in sidebar area
    with st.sidebar:
        st.header("Document")
        # File uploader is present but disabled
        st.file_uploader(
            "Upload a PDF",
            type=["pdf"],
            disabled=True,
            help="PDF upload will be enabled soon."
        )

        # Load sample document into session state
        if st.button("Load sample document"):
            # Put sample document into session state
            st.session_state.document = get_sample_document()
            # Set reading position
            st.session_state.current_chunk = 0
            # Record time we began reading this chunk
            st.session_state.chunk_start_time = time.time()
            # Hide any interventions
            st.session_state.show_intervention = False
            # Rerun script to update UI
            st.rerun()

        st.divider()
        st.header("Settings")

        # Slider for intervention threshold preferences stored
        # in preferences session state
        st.session_state.preferences["intervention_threshold"] = st.slider(
            "Pause threshold (seconds)",
            min_value = 30,
            max_value = 120,
            value = st.session_state.preferences["intervention_threshold"],
            help="How long before FocusFlow offers a recap."
        )

        # Debug mode toggle
        st.session_state.debug_mode = st.checkbox(
            "Debug mode",
            value = st.session_state.debug_mode
        )

# Main UI for welcome state
def render_welcome_state() -> None:
    """
    Render UI that appears when no document is loaded.
    """
    st.info("Load the sample document to get started.")

    with st.expander("How FocusFlow works"):
        st.markdown(
            """
            **FocusFlow's core loop:**
            1. Upload a PDF document  
            2. FocusFlow breaks it into small chunks  
            3. You read one chunk at a time  
            4. If you pause too long, FocusFlow offers a quick recap  
            """
        )

# Main UI for reading state
def render_reading_state(document: dict) -> None:
    """
    Render UI that appears when document exists.

    @param document: A dict representing the document model
    """
    #Header showing which docuemnt is loaded
    st.subheader(f"Reading: {document['filename']}")
    st.caption(f"{document['total_chunks']} sections • Scroll to read")

    with st.sidebar:
        st.divider()
        st.header("Jump to section")

        # List of titles that map to chunk indices
        chunk_titles = [f"{i+1}. {c['title']}" for i, c in enumerate(document["chunks"])]
        # Let the user select a chunk to jump to
        selected = st.selectbox(
            "Section",
            options=list(range(len(chunk_titles))),
            format_func=lambda i: chunk_titles[i],
            # Start at what's stored
            index=st.session_state.current_chunk,
        )

        # Store the selected section index
        st.session_state.current_chunk = selected

    # Render the entire document in order
    selected_idx = st.session_state.current_chunk

    for idx, chunk in enumerate(document["chunks"]):
        # Highlight the selected chunk
        is_selected = (idx == selected_idx)
        # Add a line between chunks
        st.divider()

        # Show the chunk title
        # If selected add symbol so it stands out
        title_prefix = "◎ " if is_selected else ""
        st.markdown(f"### {title_prefix}{idx + 1}. {chunk['title']}")

        # Box the section
        with st.container(border=True):
            st.info(f"**Key idea:** {chunk['key_idea']}")

            # Render the text content
            st.markdown(chunk["content"])

    
def main() -> None:
    """
    Main function for the app that will run on every rerun.

    """
    render_sidebar()

    # Header
    st.title("FocusFlow")
    st.caption("Your AI reading companion for staying focused")

    # Decide which UI state to show based on whether a document is loaded
    if st.session_state.document is None:
        render_welcome_state()
    else:
        render_reading_state(st.session_state.document)

    if st.session_state.debug_mode:
        with st.expander("Debug: session state"):
            st.json(dict(st.session_state))


# Run the app
main()