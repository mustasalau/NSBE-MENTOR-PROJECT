from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import openai
import numpy as np
from utils import load_vectors, get_openai_vector, find_most_similar_hobby
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# FastAPI App
app = FastAPI()

# Allow Frontend Access (Update origin in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Hobby Vectors
hobby_vectors = load_vectors('openAI_hobby_vectors.json')

# OpenAI Key
openai.api_key = os.getenv("OPENAI_API_KEY")

# Request Body Structure
class HobbyInput(BaseModel):
    term: str

# Routes
@app.post("/match-hobby")
def match_hobby(data: HobbyInput):
    new_vector = get_openai_vector(data.term)
    best_match, similarity = find_most_similar_hobby(new_vector, hobby_vectors)

    return {
        "input": data.term,
        "matched_hobby": best_match,
        "similarity": similarity
    }
