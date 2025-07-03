import openai
import json
import os
from dotenv import load_dotenv


# Toggle this flag to switch between traits and hobbies
use_traits = False  # Set to False for hobbies

# Load .env with OpenAI key
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir,  '.env')
load_dotenv(env_path)
print(f"Loaded .env from: {env_path}")
print(f"OPENAI_API_KEY: {os.getenv('OPENAI_API_KEY')}")
# Explicit OpenAI client setup
client = openai.Client(api_key=os.getenv("OPENAI_API_KEY"))

# Set paths based on toggle
data_file = 'traits.json' if use_traits else 'hobbies.json'
output_file = 'openAI_trait_vectors.json' if use_traits else 'openAI_hobby_vectors.json'
data_path = os.path.join(script_dir, '..', '..', 'src', 'data', data_file)
output_path = os.path.join(script_dir, output_file)

# Load Data
with open(data_path, 'r') as f:
    items = json.load(f)

# Vectorize
vectors = {}
for item in items:
    print(f"Vectorizing: {item}")
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input= f'This is a hobby or leisure activity someone might enjoy: {item}' if not use_traits else f'This is a personal trait or characteristic: {item}',
    )
    vectors[item] = response.data[0].embedding

# Save Vectors
with open(output_path, "w") as f:
    json.dump(vectors, f, indent=2)

print(f"Saved {len(vectors)} vectors to {output_path}")
