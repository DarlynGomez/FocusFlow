# Backend 

This is the backend of our FocusFlow Project, where the core logic of our agent will lies within


## How to run

1. cd into the `backend` directory
2. Create a virtual environment if you haven't already done so: `python -m venv venv`
3. Run the virtual environment with this command `venv\Scripts\activate` and type `deactivate` to shut down the virtual environment
4. Install all the dependencies with the command: `pip install -r requirements.txt`
5. Then run `uvicorn app.main:app --reload` to get the backend running
