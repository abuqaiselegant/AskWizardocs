import os
from dotenv import load_dotenv
from openai import OpenAI
import chromadb

load_dotenv()

client = chromadb.PersistentClient(path="chroma_db")
col = client.get_collection("askml_docs")

print("Total chunks in collection:", col.count())

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
response = openai_client.embeddings.create(
    model="text-embedding-3-small",
    input=["How do LangChain agents work?"]
)
vector = response.data[0].embedding

results = col.query(
    query_embeddings=[vector],
    n_results=3,
    include=["documents", "metadatas", "distances"]
)

print("\nRaw distances:", results["distances"][0])
print("\nFirst result text:", results["documents"][0][0][:300])