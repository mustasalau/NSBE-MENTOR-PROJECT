import openai
import json
import os
from dotenv import load_dotenv

# Load .env with OpenAI key
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '..', '.env')
load_dotenv(env_path)

openai.api_key = os.getenv("OPENAI_API_KEY")

# Load Hobby List
hobbies_path = os.path.join(script_dir, '..', 'src', 'data', 'hobbies.json')
with open(hobbies_path, 'r') as f:
    hobbies = json.load(f)

vectors = {}

for hobby in hobbies:
    print(f"Vectorizing: {hobby}")
    response = openai.embeddings.create(
        model="text-embedding-3-small",
        input=hobby
    )
    vectors[hobby] = response.data[0].embedding

# Save Vectors to Output Path
output_path = os.path.join(script_dir, '..', 'src', 'data', 'openAI_hobby_vectors.json')
with open(output_path, "w") as f:
    json.dump(vectors, f, indent=2)

print(f"Saved {len(vectors)} hobby vectors to {output_path}")
