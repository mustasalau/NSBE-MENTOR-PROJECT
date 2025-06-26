import json
from gensim.models import KeyedVectors
import numpy as np
import gensim.downloader as api
import os


# Load Model
model = api.load("word2vec-google-news-300")

# Load Hobbies List

script_dir = os.path.dirname(os.path.abspath(__file__))
file_path = os.path.join(script_dir, 'src', 'data', 'hobbies.json')

with open(file_path, 'r') as f:
    hobbies = json.load(f)

# Function to Get Phrase Vector
def get_phrase_vector(phrase, model):
    words = phrase.lower().split()
    vectors = []
    
    for word in words:
        if word in model:
            vectors.append(model[word])
    
    if vectors:
        return np.mean(vectors, axis=0)
    else:
        return None

# Create Dictionary of Hobby Vectors
hobby_vectors = {}

for hobby in hobbies:
    vec = get_phrase_vector(hobby, model)
    if vec is not None:
        hobby_vectors[hobby] = vec.tolist()  # Convert numpy array to list for JSON

# Save to JSON File
output_path = os.path.join(script_dir, '..', 'src', 'data', 'hobby_vectors.json')
os.makedirs(os.path.dirname(output_path), exist_ok=True)


with open(output_path, 'w') as f:
    json.dump(hobby_vectors, f, indent=2)

print(f"Saved {len(hobby_vectors)} hobby vectors to {output_path}")
