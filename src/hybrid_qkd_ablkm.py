"""
=============================================================================
  Hybrid Protocol: QKD BB84 + ABLKM Post-Quantum Storage
=============================================================================
This script orchestrates the end-to-end integration of Quantum Key Distribution 
(BB84) with the Angular-Bucket Lattice Key Mapping (ABLKM) engine.
"""

import json
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from typing import Tuple

from qkd_bb84 import execute_bb84
from lattice_crypto_v2 import HardenedLatticeKeyStore

def run_phase_1_qkd() -> bytes:
    """Executes BB84 to generate a shared 256-bit AES key through the quantum channel."""
    print("="*64)
    print("  PHASE 1: QUANTUM KEY DISTRIBUTION (BB84)")
    print("="*64)
    return execute_bb84()

def run_phase_2_parameter_exchange(shared_secret: bytes) -> Tuple[HardenedLatticeKeyStore, tuple]:
    """Bob initializes ABLKM, defines P_ref, and sends it to Alice over AES-GCM."""
    print("="*64)
    print("  PHASE 2: SECURE SHARING OF ABLKM PARAMETERS")
    print("="*64)
    
    # 1. Bob initializes Server Lattice
    print("[Bob] Initializing ABLKM database backend...")
    bob_server = HardenedLatticeKeyStore(grid_size=6, dim=3, points_per_bucket=4)
    pref = bob_server.ref
    print(f"[Bob] Secret P_ref coordinate generated: (~{pref[0]:.2f}, ~{pref[1]:.2f}, ~{pref[2]:.2f})")
    
    # 2. Bob encrypts P_ref using the quantum key
    print("[Bob] Encrypting P_ref with BB84 shared secret...")
    nonce = os.urandom(12)
    aesgcm = AESGCM(shared_secret)
    pref_bytes = json.dumps(pref).encode()
    ciphertext = aesgcm.encrypt(nonce, pref_bytes, None)
    
    # 3. Network Transfer
    payload = {"nonce": nonce.hex(), "ciphertext": ciphertext.hex()}
    print(f"[Network] Sent Payload to Alice: {payload['ciphertext'][:32]}...")

    # 4. Alice receives and decrypts
    print("\n[Alice] Received payload. Decrypting with BB84 shared secret...")
    alice_aes = AESGCM(shared_secret)
    decrypted_pref_bytes = alice_aes.decrypt(
        bytes.fromhex(payload['nonce']), 
        bytes.fromhex(payload['ciphertext']), 
        None
    )
    alice_pref = tuple(json.loads(decrypted_pref_bytes.decode()))
    print(f"[Alice] Successfully recovered P_ref!")
    
    return bob_server, alice_pref

def run_phase_3_secure_communication(bob_server: HardenedLatticeKeyStore, alice_pref: tuple):
    """Alice initializes her local ABLKM with P_ref, encrypts data, and sends to Bob."""
    print("\n" + "="*64)
    print("  PHASE 3: SECURE COMMUNICATIONS VIA ABLKM")
    print("="*64)
    
    # Alice initializes client
    alice_client = HardenedLatticeKeyStore(grid_size=6, dim=3, points_per_bucket=4, ref_coords=alice_pref)
    
    # Alice stores a message
    message = "Launch the rockets at midnight! - Alice"
    print(f"\n[Alice] Storing message: '{message}'")
    alice_client.store_key("msg_001", message)
    
    # Simulate network transfer of bucketing mapping
    print("[Network] Alice uploads ciphertext to Bob's ABLKM Server bucket...")
    bob_server.buckets = alice_client.buckets
    bob_server._registry = alice_client._registry
    
    # Bob retrieves and decodes
    print("\n[Bob] Retrieving message 'msg_001' from ABLKM...")
    retrieved = bob_server.retrieve_key("msg_001")
    print(f"[Bob] Message decoded: '{retrieved}'")

    # Eve attempt to intercept
    print("\n[Eve] Attacker trying to decode without P_ref...")
    try:
        eve_server = HardenedLatticeKeyStore(grid_size=6, dim=3, points_per_bucket=4) # Eve lacks P_ref
        eve_server.buckets = bob_server.buckets
        eve_server._registry = bob_server._registry
        eve_server.retrieve_key("msg_001")
    except Exception as e:
        print(f"[Eve] Failed to read message! Error: {e}")

def main():
    shared_secret = run_phase_1_qkd()
    bob_server, alice_pref = run_phase_2_parameter_exchange(shared_secret)
    run_phase_3_secure_communication(bob_server, alice_pref)

if __name__ == "__main__":
    main()
