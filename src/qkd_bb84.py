"""
=============================================================================
  BB84 Protocol Simulation for QKD + ABLKM Hybrid
=============================================================================
Simulates the BB84 Quantum Key Distribution protocol.
Alice and Bob exchange single photons, measure them, and sift their keys to 
establish a secure shared cryptographic key while detecting eavesdroppers.
"""

import random
import hashlib
from typing import List, Tuple, Dict, Any

# --- Constants ---
DEFAULT_QUBIT_COUNT = 1024
QBER_THRESHOLD = 0.11

class Qubit:
    """Represents a single photon (Qubit) defined by its bit and polarization basis."""
    def __init__(self, bit: int, basis: int):
        self.bit: int = bit
        self.basis: int = basis  # 0 for Rectilinear (+), 1 for Diagonal (x)
        self.measured: bool = False

    def measure(self, measurement_basis: int) -> int:
        """
        Measure the Qubit. 
        If the bases match, it returns the exact bit. 
        If they mismatch, the state collapses and returns a random bit.
        """
        if self.measured:
            raise RuntimeError("Qubit already measured! States cannot be reused (No-Cloning Theorem).")
        self.measured = True
        
        if self.basis == measurement_basis:
            return self.bit
        return random.randint(0, 1)

class QKDBB84Session:
    """Manages the lifecycle of a BB84 Key Distribution session between Alice and Bob."""
    def __init__(self, num_qubits: int = DEFAULT_QUBIT_COUNT):
        self.num_qubits: int = num_qubits
        self.quantum_channel: List[Qubit] = []
        self.classical_channel: Dict[str, Any] = {}
        
        self.alice_bits: List[int] = []
        self.alice_bases: List[int] = []
        self.bob_bases: List[int] = []
        self.bob_measured_bits: List[int] = []
        
    def alice_prepare_and_send(self) -> None:
        """Alice generates random bits and encodes them into photons with random bases."""
        self.alice_bits = [random.randint(0, 1) for _ in range(self.num_qubits)]
        self.alice_bases = [random.randint(0, 1) for _ in range(self.num_qubits)]
        self.quantum_channel = [Qubit(bit, basis) for bit, basis in zip(self.alice_bits, self.alice_bases)]
        print(f"[QKD] Alice sent {self.num_qubits} qubits over the quantum channel.")

    def bob_receive_and_measure(self) -> None:
        """Bob randomly guesses measurement filters (bases) and measures the incoming photons."""
        self.bob_bases = [random.randint(0, 1) for _ in range(self.num_qubits)]
        self.bob_measured_bits = [q.measure(basis) for q, basis in zip(self.quantum_channel, self.bob_bases)]
        print(f"[QKD] Bob measured {self.num_qubits} qubits.")
        self.quantum_channel = [] # Consume channel

    def exchange_bases(self) -> None:
        """Alice and Bob share the bases they used over a public, unencrypted network."""
        self.classical_channel['alice_bases'] = self.alice_bases
        self.classical_channel['bob_bases'] = self.bob_bases
        print("[QKD] Alice and Bob exchanged basis information over the public channel.")

    def sift_keys(self) -> Tuple[List[int], List[int]]:
        """Discard bits where measurement bases didn't match. Calculate Quantum Bit Error Rate (QBER)."""
        alice_sifted: List[int] = []
        bob_sifted: List[int] = []
        
        for i in range(self.num_qubits):
            if self.classical_channel['alice_bases'][i] == self.classical_channel['bob_bases'][i]:
                alice_sifted.append(self.alice_bits[i])
                bob_sifted.append(self.bob_measured_bits[i])
                
        if not alice_sifted:
            return [], []
            
        error_rate = sum(1 for a, b in zip(alice_sifted, bob_sifted) if a != b) / len(alice_sifted)
        print(f"[QKD] Sifted key length: {len(alice_sifted)} bits. QBER: {error_rate*100:.2f}%")
        
        if error_rate > QBER_THRESHOLD:
            raise RuntimeError("Eve detected! Quantum Bit Error Rate safely threshold exceeded.")
            
        return alice_sifted, bob_sifted

    def derive_shared_secret(self, sifted_key: List[int]) -> bytes:
        """Privacy Amplification: Hash the raw variable-length bit sequence into a strict 256-bit AES key."""
        return hashlib.sha256("".join(map(str, sifted_key)).encode()).digest()

def execute_bb84(num_qubits: int = DEFAULT_QUBIT_COUNT) -> bytes:
    """Executes a full BB84 simulation and returns the identical shared 256-bit secret key."""
    session = QKDBB84Session(num_qubits)
    session.alice_prepare_and_send()
    session.bob_receive_and_measure()
    session.exchange_bases()
    
    alice_sifted, bob_sifted = session.sift_keys()
    
    alice_key = session.derive_shared_secret(alice_sifted)
    bob_key = session.derive_shared_secret(bob_sifted)
    
    assert alice_key == bob_key, "Keys do not match! Something failed."
    print(f"[QKD] Final Shared Key Established: {alice_key.hex()[:16]}...\n")
    
    return alice_key

if __name__ == "__main__":
    execute_bb84()
