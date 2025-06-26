import json
import numpy as np
import openai
from scipy.spatial.distance import cosine

def load_vectors(filepath):
    """Load saved hobby vectors from JSON."""
    with open(filepath, 'r') as f:
        data = json.load(f)
    return {hobby: np.array(vec) for hobby, vec in data.items()}

def get_openai_vector(term):
    """Get embedding for a new term from OpenAI."""
    response = openai.embeddings.create(
    model="text-embedding-3-small",
    input=term
)
    return np.array(response.data[0].embedding)


def find_most_similar_hobby(new_vector, hobby_vectors):
    """Compare new vector to existing hobby vectors, return best match."""
    best_match = None
    highest_similarity = -1

    for hobby, vec in hobby_vectors.items():
        similarity = 1 - cosine(new_vector, vec)
        if similarity > highest_similarity:
            highest_similarity = similarity
            best_match = hobby

    return best_match, highest_similarity
