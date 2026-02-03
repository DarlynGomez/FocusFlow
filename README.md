

# FocusFlow

**FocusFlow is an AI reading companion for anyone with a non-neurotypical style of reading that helps them stay oriented while reading dense academic papers.**  

It targets a specific breakdown that happens during reading: **“drift.”** Your eyes keep moving, but comprehension stops. When you snap back, you’ve lost the thread of the argument and end up rereading sections repeatedly-causing frustration, fatigue, and often giving up.

FocusFlow is built to solve that exact moment by being:

- **Position-aware**: it knows *where you are* in the document (down to the current chunk/section)
- **Behavior-responsive**: it watches for signals that you might be stuck (ex: pausing too long)
- **In-context**: it re-orients you using the *exact section you’re in* and how it connects to the paper’s thesis


---

## How to Run Locally

### 1. Clone the repository
```bash
git clone https://github.com/DarlynGomez/FocusFlow
cd FocusFlow
````

### 2. Create and activate a virtual environment

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the app

```bash
streamlit run app.py
```

Open the local URL shown in your terminal (usually `http://localhost:8501`).


