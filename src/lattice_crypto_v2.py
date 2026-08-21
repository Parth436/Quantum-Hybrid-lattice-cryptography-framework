"""
=============================================================================
  ABLKM v2 — Angular-Bucket Lattice Key Mapping (Hardened Edition)
=============================================================================
Implementation of post-quantum lattice bucketing using n-dimensional angular 
hashing, AES-256-GCM authentication, and HKDF-SHA256 key derivation.
"""

import math
import hashlib
import hmac
import os
import secrets
import itertools
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes

# --- Data Structures ---

@dataclass
class LatticePoint:
    """A single coordinate point in the n-dimensional integer lattice."""
    coords: Tuple[float, ...]
    index: int
    bucket_id: int = -1
    angle: float = 0.0

    def __repr__(self):
        return f"LP[{self.index}]({','.join(f'{x:.2f}' for x in self.coords)})"

@dataclass
class BucketEntry:
    """Encrypted record stored inside a bucket."""
    key_id: bytes         # HMAC-SHA256 authenticated key name
    nonce: bytes          # AES-GCM nonce 
    ciphertext: bytes     # AES-256-GCM ciphertext + tag
    point_index: int      
    angle: float          
    salt: bytes           # HKDF random salt

@dataclass
class Bucket:
    """An angular sector of the n-dimensional lattice."""
    bucket_id: int
    angle_start: float
    angle_end: float
    lattice_points: List[int] = field(default_factory=list)
    entries: dict = field(default_factory=dict)

    def angle_start_deg(self): return math.degrees(self.angle_start) % 360
    def angle_end_deg(self): return math.degrees(self.angle_end) % 360

# --- Crypto & Math Utilities ---

def angular_hash_nd(vector: Tuple[float, ...]) -> float:
    """Compute an azimuthal angle in [0, 2π) for an n-dimensional vector projection."""
    if len(vector) < 2:
        raise ValueError("Need at least 2D vector for angular hash")
    magnitude = math.sqrt(sum(x * x for x in vector))
    if magnitude < 1e-12:
        return 0.0
    return math.atan2(vector[1] / magnitude, vector[0] / magnitude) % (2 * math.pi)

def derive_encryption_key(key_string: str, lattice_point: LatticePoint, ref_coords: Tuple[float, ...], salt: bytes) -> bytes:
    """Derive a 32-byte AES key using HKDF-SHA256 bound to the key, physical point, and P_ref."""
    pt_str = ",".join(f"{c:.6f}" for c in lattice_point.coords)
    ref_str = ",".join(f"{c:.6f}" for c in ref_coords)
    ikm = hashlib.sha256(f"{key_string}|{pt_str}|{ref_str}".encode()).digest()
    hkdf = HKDF(algorithm=hashes.SHA256(), length=32, salt=salt, info=b"ABLKM-v2-AES256GCM")
    return hkdf.derive(ikm)

def derive_key_id(key_string: str, ref_coords: Tuple[float, ...]) -> bytes:
    """Compute an authenticated bucket key identifier via HMAC-SHA256 to resist offline dictionary attacks."""
    hmac_key = hashlib.sha256(",".join(f"{c:.6f}" for c in ref_coords).encode()).digest()
    return hmac.new(hmac_key, key_string.encode(), hashlib.sha256).digest()

# --- Main KeyStore Engine ---

class HardenedLatticeKeyStore:
    """
    ABLKM v2 Engine. Securely stores generic string data (Payload) mapped precisely 
    to Lattice coordinate buckets mathematically derived from a shared secret coordinate (ref).
    """
    def __init__(
        self,
        grid_size: int = 6,
        dim: int = 2,
        points_per_bucket: int = 4,
        ref_coords: Optional[Tuple[float, ...]] = None,
        ref_radius_factor: float = 0.3,
        basis: Optional[List[List[float]]] = None,
    ):
        if dim < 2:
            raise ValueError("Minimum dimension is 2.")

        self.grid_size = grid_size
        self.dim = dim
        self.ppb = points_per_bucket
        self.ref_factor = ref_radius_factor
        self.basis = basis if basis else self._identity_basis()

        self.lattice_points: List[LatticePoint] = self._generate_lattice()
        self.num_points = len(self.lattice_points)
        self.ref = ref_coords if ref_coords else self._generate_ref_point_secure()

        self.num_buckets = math.ceil(self.num_points / self.ppb)
        self.bucket_width = (2 * math.pi) / self.num_buckets
        self.buckets: List[Bucket] = self._init_buckets()
        self._assign_points()

        self._registry: dict = {} # Maps key_id (hex string) -> bucket_id

    def _identity_basis(self) -> List[List[float]]:
        return [[1.0 if i == j else 0.0 for j in range(self.dim)] for i in range(self.dim)]

    def _generate_lattice(self) -> List[LatticePoint]:
        points = []
        for idx, indices in enumerate(itertools.product(range(self.grid_size), repeat=self.dim)):
            coords = [0.0] * self.dim
            for k, coeff in enumerate(indices):
                for d in range(self.dim):
                    coords[d] += coeff * self.basis[k][d]
            points.append(LatticePoint(tuple(coords), idx))
        return points

    def _generate_ref_point_secure(self) -> Tuple[float, ...]:
        rng = secrets.SystemRandom()
        xs = [p.coords[d] for p in self.lattice_points for d in range(self.dim)]
        centroid = tuple(sum(p.coords[d] for p in self.lattice_points) / self.num_points for d in range(self.dim))
        radius = self.ref_factor * (max(xs) - min(xs) if xs else 1.0)

        for _ in range(100_000):
            candidate = tuple(centroid[d] + rng.uniform(-radius, radius) for d in range(self.dim))
            # Ensure not directly on any existing mathematical point
            if not any(all(abs(candidate[d] - p.coords[d]) < 1e-9 for d in range(self.dim)) for p in self.lattice_points):
                return candidate
        raise RuntimeError("Failed to generate isolated P_ref.")

    def _init_buckets(self) -> List[Bucket]:
        return [Bucket(i, i * self.bucket_width, (i + 1) * self.bucket_width) for i in range(self.num_buckets)]

    def _point_angle(self, pt: LatticePoint) -> float:
        return angular_hash_nd(tuple(pt.coords[d] - self.ref[d] for d in range(self.dim)))

    def _assign_points(self):
        for pt in self.lattice_points:
            pt.angle = self._point_angle(pt)
            pt.bucket_id = min(int(pt.angle / self.bucket_width), self.num_buckets - 1)
            self.buckets[pt.bucket_id].lattice_points.append(pt.index)

    def _key_to_point(self, key: str) -> LatticePoint:
        idx = int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], "big") % self.num_points
        return self.lattice_points[idx]

    def store_key(self, key: str, value: str) -> dict:
        """Stores the given value string, returning encryption metadata."""
        key_id_bytes = derive_key_id(key, self.ref)
        key_id_hex = key_id_bytes.hex()
        
        pt = self._key_to_point(key)
        angle = self._point_angle(pt)
        bid = min(int(angle / self.bucket_width), self.num_buckets - 1)

        salt = os.urandom(32)
        aes_key = derive_encryption_key(key, pt, self.ref, salt)
        
        nonce = os.urandom(12)
        ciphertext = AESGCM(aes_key).encrypt(nonce, value.encode(), None)

        self.buckets[bid].entries[key_id_hex] = BucketEntry(key_id_bytes, nonce, ciphertext, pt.index, angle, salt)
        self._registry[key_id_hex] = bid

        return {"bucket_id": bid, "lattice_point": repr(pt), "angle_deg": round(math.degrees(angle), 3)}

    def retrieve_key(self, key: str) -> Optional[str]:
        """Retrieves and authenticates the value for a given key string."""
        key_id_hex = derive_key_id(key, self.ref).hex()
        if key_id_hex not in self._registry:
            return None

        bid = self._registry[key_id_hex]
        entry = self.buckets[bid].entries.get(key_id_hex)
        if not entry:
            return None

        aes_key = derive_encryption_key(key, self._key_to_point(key), self.ref, entry.salt)
        try:
            return AESGCM(aes_key).decrypt(entry.nonce, entry.ciphertext, None).decode()
        except Exception:
            raise ValueError(f"Authentication failed for '{key}' - data tampered.")

    def delete_key(self, key: str) -> bool:
        key_id_hex = derive_key_id(key, self.ref).hex()
        if key_id_hex in self._registry:
            bid = self._registry.pop(key_id_hex)
            self.buckets[bid].entries.pop(key_id_hex, None)
            return True
        return False

# --- Quick Evaluation ---

def demo():
    print("\n" + "="*60 + "\n  ABLKM v2: Functional Test\n" + "="*60)
    store = HardenedLatticeKeyStore(grid_size=5, dim=3, points_per_bucket=5)
    
    test_keys = [("db_user", "admin"), ("db_pass", "super_secret")]
    
    for k, v in test_keys:
        info = store.store_key(k, v)
        print(f"Stored '{k}' -> Bucket {info['bucket_id']} at {info['lattice_point']}")
        
    print("\nRetrieval Verification:")
    for k, expected in test_keys:
        got = store.retrieve_key(k)
        print(f"Fetch '{k}': {'SUCCESS' if got == expected else 'FAILED'}")

if __name__ == "__main__":
    demo()
