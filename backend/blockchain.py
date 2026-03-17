import hashlib
import json
from time import time

chain = []

def create_block(index, timestamp, data, previous_hash):
    block = {
        "index": index,
        "timestamp": timestamp,
        "data": data,
        "previous_hash": previous_hash,
        "hash": hashlib.sha256(f"{index}{timestamp}{data}{previous_hash}".encode()).hexdigest()
    }
    return block

def get_chain():
    return chain

def add_block(data):
    timestamp = time()
    index = len(chain) + 1
    previous_hash = chain[-1]["hash"] if chain else "0"
    block = create_block(index, timestamp, data, previous_hash)
    chain.append(block)
