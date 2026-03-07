"""
Quick sanity check — query Chroma directly to verify
embeddings are stored and retrieval is working.
"""

import os
from dotenv import load_dotenv
from openai import OpenAI
import chromadb

load_dotenv()

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
chroma_client = chromadb.PersistentClient(path="chroma_db")
collection    = chroma_client.get_collection("askml_docs")

def query(question: str, n=3):
    # embed the question
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=[question]
    )
    vector = response.data[0].embedding

    # search Chroma
    results = collection.query(
        query_embeddings=[vector],
        n_results=n,
        include=["documents", "metadatas", "distances"]
    )

    for i, (doc, meta, dist) in enumerate(zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0]
    )):
        print(f"\n--- Result {i+1} (distance: {dist:.4f}) ---")
        print(f"Source: {meta['url']}")
        print(f"Title:  {meta['title']}")
        print(f"Text:   {doc[:200]}...")

if __name__ == "__main__":
    query("How does LangChain handle memory in agents?")