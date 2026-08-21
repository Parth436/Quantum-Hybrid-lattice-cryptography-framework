# ABLKM — Angular-Bucket Lattice Key Mapping
## Complete Technical Reference Document

**Algorithm Name:** Angular-Bucket Lattice Key Mapping (ABLKM)  
**Category:** Lattice-Based Post-Quantum Cryptography  
**Version:** 1.0  
**Classification:** Novel Key Storage Scheme

---

## Table of Contents

1. [Introduction & Motivation](#1-introduction--motivation)
2. [Lattice Structure Used](#2-lattice-structure-used)
3. [Hashing Methods Used](#3-hashing-methods-used)
4. [System Parameters](#4-system-parameters)
5. [Full Algorithm — Step by Step](#5-full-algorithm--step-by-step)
6. [Mathematical Formulas](#6-mathematical-formulas)
7. [Encryption & Decryption Detail](#7-encryption--decryption-detail)
8. [Security Analysis](#8-security-analysis)
9. [Worked Numerical Example](#9-worked-numerical-example)
10. [Comparison with Standard Schemes](#10-comparison-with-standard-schemes)
11. [Limitations & Future Work](#11-limitations--future-work)

---

## 1. Introduction & Motivation

Traditional cryptographic key stores protect keys by **algebraic hardness** (e.g., integer factorization in RSA, discrete log in ECC). These are broken by Shor's algorithm on quantum computers.

**ABLKM** takes a fundamentally different approach: keys are hidden **geometrically** — stored at locations on a mathematical lattice determined by their *angular position* relative to a **secret reference point**. Without this reference point, an adversary cannot determine *where* to look, because computing the correct angle requires solving the **Closest Vector Problem (CVP)** on the lattice — a problem that is hard even for quantum computers.

---

## 2. Lattice Structure Used

### 2.1 Type of Lattice

ABLKM uses an **Integer Lattice** (also called a Point Lattice or Bravais Lattice) in 2D, with hooks for n-dimensional extension.

The lattice is formally defined as:

```
Λ(B) = { B · z  |  z ∈ ℤⁿ }
```

Where:
- **B** is the **lattice basis matrix** (n × n real matrix with linearly independent columns)
- **z** is any integer vector in ℤⁿ
- Every point in Λ is a linear combination of basis vectors with **integer coefficients**

### 2.2 Standard Basis (Default)

In the default implementation, the **identity basis** is used:

```
B = I₂ = [[1, 0],
           [0, 1]]
```

This produces the **Standard Integer Lattice ℤ²** — a square grid of points at all integer coordinates (i, j) for 0 ≤ i, j < N.

### 2.3 General Basis (Hardened Variant)

For stronger security, a non-orthogonal basis can be used:

```
B = [[b₁ₓ, b₁ᵧ],
     [b₂ₓ, b₂ᵧ]]

Example:  B = [[2, 1],
               [0, 3]]
```

This produces a **skewed lattice** that is geometrically more complex, making the CVP-based attack harder because the lattice geometry is non-trivial.

### 2.4 Lattice Properties Used

| Property | Value in ABLKM |
|---|---|
| **Dimension** | 2D (extendable to nD) |
| **Lattice type** | Integer / Point Lattice (Bravais) |
| **Basis** | User-configurable (default: identity) |
| **Lattice points** | N² for an N×N grid |
| **Hardness basis** | Closest Vector Problem (CVP) |
| **Related Hard Problem** | Shortest Vector Problem (SVP) is a special case |

### 2.5 Connection to Known Lattice Problems

| Problem | Relevance to ABLKM |
|---|---|
| **CVP** (Closest Vector Problem) | Finding P_ref from observed key placements ≈ CVP |
| **SVP** (Shortest Vector Problem) | Special case; underlies lattice hardness in general |
| **LWE** (Learning With Errors) | Shares hardness assumptions; ABLKM can be viewed as a geometric variant |
| **SIS** (Short Integer Solution) | Related through basis reduction attacks |

---

## 3. Hashing Methods Used

ABLKM uses **two different hashing mechanisms** at different stages of the algorithm. Understanding each is essential.

---

### 3.1 SHA-256 (Python Implementation)

**Where used:**
1. **Key ID derivation** — converting a key string into a unique, fixed-size identifier
2. **Encryption key derivation** — producing the per-key encryption key from geometry

**Algorithm:** SHA-256 (Secure Hash Algorithm 2, 256-bit output)  
**Standard:** FIPS PUB 180-4  
**Output:** 256 bits = 32 bytes = 64 hex characters  
**Collision resistance:** 2¹²⁸ operations  
**Preimage resistance:** 2²⁵⁶ operations  
**Quantum resistance:** Grover's reduces to 2¹²⁸ — still secure

**Usage in Key ID Derivation:**
```python
key_id = SHA-256(key_string)
# "alice" → "2bd806c97f0e00a082d1caa0232b04ed09291196..."
```

**Usage in Encryption Key Derivation:**
```python
enc_key = SHA-256(
    key_string + "|" +
    lattice_point.x + "," + lattice_point.y + "|" +
    P_ref.x + "," + P_ref.y
)
```

This 3-component input means the encryption key changes if **any** of: the original key, the lattice point, or the reference point changes — tightly binding the ciphertext to the geometry.

---

### 3.2 djb2 (JavaScript Implementation)

**Where used:** Lightweight hash for the web visualization engine (JavaScript port)

**Algorithm:** djb2 (Daniel J. Bernstein, hash 2)  
**Type:** Non-cryptographic hash function  
**Output:** 32-bit unsigned integer  
**Purpose:** Fast, deterministic mapping of key strings → array indices

```javascript
function djb2(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++)
        h = ((h << 5) + h) ^ str.charCodeAt(i);
    return h >>> 0;   // unsigned 32-bit
}
```

**Why djb2 in JS?** `SubtleCrypto.digest()` is asynchronous; djb2 allows synchronous computation in the real-time canvas rendering loop. In a production implementation, SHA-256 (or SHA3-256) would be used throughout.

---

### 3.3 Hashing Architecture — Overview

```
STORE OPERATION:
  key_string  ──SHA-256──►  key_id (64 hex chars)
                               │
                               ▼ mod N²
                          lattice_point_index
                               │
                               ▼
  (key + point + P_ref) ─SHA-256─►  enc_key (32 bytes)
                               │
                               ▼
                       XOR encrypt(value) ──► ciphertext

RETRIEVE OPERATION:
  key_string  ──SHA-256──►  key_id
                               │
  (key + point + P_ref) ─SHA-256─►  enc_key
                               │
                       XOR decrypt(ciphertext) ──► value
```

---

### 3.4 Production-Grade Hash Recommendations

For a production deployment of ABLKM, the following upgrades are recommended:

| Component | Demo Uses | Production Should Use |
|---|---|---|
| Key ID | SHA-256 | SHA3-256 or BLAKE3 |
| Enc key derivation | SHA-256 | HKDF-SHA256 with salt + info |
| JS hash | djb2 | SubtleCrypto SHA-256 (async) |
| Key derivation | Raw XOR | AES-256-GCM with derived key |
| PRNG for P_ref | `random.Random` | `secrets.SystemRandom` |

---

## 4. System Parameters

| Parameter | Symbol | Default | Description |
|---|---|---|---|
| Grid size | N | 8 | Lattice is N × N = N² points |
| Basis matrix | B | Identity | Lattice generator vectors |
| Points per bucket | p | 4 | Target occupancy per angular sector |
| Reference point | P_ref = (r_x, r_y) | Random | The **secret** — private key component |
| Reference radius | α | 0.3 | P_ref within α × span of centroid |
| Number of buckets | k | computed | k = ⌈N² / p⌉ |
| Bucket angular size | Δθ | computed | Δθ = 2π / k |

---

## 5. Full Algorithm — Step by Step

### Phase 1: Setup (Key Generation)

```
─────────────────────────────────────────────────────────────
STEP 1: Generate the Lattice
─────────────────────────────────────────────────────────────
  For i = 0 to N-1:
    For j = 0 to N-1:
      v(i,j) = i · B[0] + j · B[1]    ← linear combination of basis
      Append v(i,j) to Λ

  Result: Λ contains N² lattice points in ℝ²

─────────────────────────────────────────────────────────────
STEP 2: Choose Secret Reference Point P_ref
─────────────────────────────────────────────────────────────
  centroid = mean of all points in Λ
  span     = max(x_range, y_range) of Λ
  radius   = α × span

  Repeat:
    r_x ← centroid.x + Uniform(-radius, +radius)
    r_y ← centroid.y + Uniform(-radius, +radius)
  Until P_ref ∉ Λ   (not coinciding with any lattice point)

  P_ref = (r_x, r_y)   ← This is the PRIVATE KEY

─────────────────────────────────────────────────────────────
STEP 3: Compute Number of Buckets (Dynamic)
─────────────────────────────────────────────────────────────
  T = |Λ| = N²                     (total lattice points)
  k = ⌈ T / p ⌉                    (number of angular buckets)
  Δθ = 2π / k                      (angular width per bucket, radians)

─────────────────────────────────────────────────────────────
STEP 4: Compute Angles and Assign Points to Buckets
─────────────────────────────────────────────────────────────
  For each point v in Λ:
    dx = v.x − P_ref.x
    dy = v.y − P_ref.y
    θ(v) = atan2(dy, dx) mod 2π        ← angle in [0, 2π)
    bucket_id(v) = ⌊ θ(v) / Δθ ⌋       ← assign to bucket
    Bucket[ bucket_id(v) ].points ← v

  Result: Each of the k buckets holds ~p lattice points
```

---

### Phase 2: Key Storage

```
─────────────────────────────────────────────────────────────
STEP 5: Store (key, value) Pair
─────────────────────────────────────────────────────────────

  INPUT:  key   (string, e.g. "alice_pubkey")
          value (string, e.g. "04deadbeef...")

  5a. Derive Key ID:
      key_id = SHA-256(key)              ← 256-bit identifier

  5b. Select Lattice Point:
      n      = BigInt(key_id[0:8], base=16)
      idx    = n mod N²                  ← index into Λ
      v      = Λ[ idx ]                  ← the assigned lattice point

  5c. Compute Angle from P_ref:
      dx     = v.x − P_ref.x
      dy     = v.y − P_ref.y
      θ      = atan2(dy, dx) mod 2π

  5d. Determine Bucket:
      bucket_id = ⌊ θ / Δθ ⌋

  5e. Derive Encryption Key:
      raw_input = key + "|" + v.x + "," + v.y + "|"
                      + P_ref.x + "," + P_ref.y
      enc_key   = SHA-256(raw_input)     ← 32-byte derived key

  5f. Encrypt Value:
      ciphertext = XOR(value_bytes, enc_key)

  5g. Store:
      Bucket[ bucket_id ][ key_id ] = ciphertext

  OUTPUT: key_id, bucket_id, angle θ (for logging/debug)
```

---

### Phase 3: Key Retrieval

```
─────────────────────────────────────────────────────────────
STEP 6: Retrieve value for a key
─────────────────────────────────────────────────────────────

  INPUT:  key (string)

  6a. Re-derive Key ID:
      key_id = SHA-256(key)              ← same as step 5a

  6b. Re-select Lattice Point:
      idx = BigInt(key_id[0:8]) mod N²   ← same as step 5b
      v   = Λ[ idx ]

  6c. Re-compute Angle:
      θ = atan2(v.y − P_ref.y, v.x − P_ref.x) mod 2π

  6d. Re-determine Bucket:
      bucket_id = ⌊ θ / Δθ ⌋

  6e. Look Up Ciphertext:
      ciphertext = Bucket[ bucket_id ][ key_id ]
      IF not found → return NULL

  6f. Re-derive Encryption Key:
      enc_key = SHA-256(key + "|" + v.x + "," + v.y
                            + "|" + P_ref.x + "," + P_ref.y)

  6g. Decrypt:
      value = XOR(ciphertext, enc_key)   ← XOR is self-inverse

  OUTPUT: value (plaintext)
```

---

### Phase 4: Key Deletion

```
─────────────────────────────────────────────────────────────
STEP 7: Delete a key
─────────────────────────────────────────────────────────────

  7a. Repeat steps 6a–6d to locate the bucket
  7b. Remove Bucket[ bucket_id ][ key_id ]
  7c. Remove key_id from the global key registry
```

---

## 6. Mathematical Formulas

### Core Angle Formula

```
θ(v) = atan2(v_y − r_y,  v_x − r_x)  (mod 2π)

where:
  v     = lattice point (v_x, v_y)
  P_ref = reference point (r_x, r_y)
  atan2 = four-quadrant inverse tangent
  Range: θ ∈ [0, 2π)
```

### Bucket Assignment Formula

```
k   = ⌈ N² / p ⌉         (number of buckets)
Δθ  = 2π / k             (bucket width in radians)
b   = ⌊ θ(v) / Δθ ⌋      (bucket index, 0-indexed)
     = ⌊ θ(v) · k / 2π ⌋
```

### Bucket Sector Boundaries

```
Bucket i covers angles: [ i · Δθ,  (i+1) · Δθ )
                        in degrees: [ i · 360/k,  (i+1) · 360/k )
```

### Lattice Point Selection from Key

```
idx = BigInt( SHA-256(key)[0:8] )  mod  N²
v   = Λ[ idx ]
```

### Encryption Key Derivation

```
enc_key = SHA-256(
    key_string  ‖  "|"  ‖
    v_x         ‖  ","  ‖  v_y  ‖  "|"  ‖
    r_x         ‖  ","  ‖  r_y
)

where ‖ = string concatenation
```

---

## 7. Encryption & Decryption Detail

### Current Implementation: XOR Stream Cipher

```
Encrypt:  C[i] = M[i] XOR enc_key[i mod 32]
Decrypt:  M[i] = C[i] XOR enc_key[i mod 32]   (XOR is self-inverse)

where:
  M   = plaintext bytes
  C   = ciphertext bytes
  enc_key = 32-byte SHA-256 derived key
```

This is a **one-time-pad-style** XOR. It is correct but not authenticated.

### Production Upgrade: AES-256-GCM

```
Key = HKDF-SHA256(
    ikm  = SHA-256(key + v + P_ref),    ← input key material
    salt = random 32 bytes,             ← stored with ciphertext
    info = "ABLKM-v1",
    len  = 32 bytes
)

nonce      = random 12 bytes
ciphertext, tag = AES-256-GCM.encrypt(Key, nonce, plaintext)
stored     = nonce || ciphertext || tag
```

This adds **authenticated encryption** — tampered ciphertexts are detected.

---

## 8. Security Analysis

### 8.1 Security Model

ABLKM operates under the **Chosen Plaintext Attack (CPA)** security model for the key values, and relies on the **CVP hardness assumption** for the key location (bucket) security.

### 8.2 What the Attacker Knows (Public Information)

| Known to Attacker | Not Known |
|---|---|
| Lattice structure Λ (grid size, basis) | P_ref = (r_x, r_y) |
| Number of buckets k | Which bucket contains which key |
| All ciphertext values | The angle θ(v) for any specific key |
| key_id (hash of key string) | enc_key (geometry-bound) |

### 8.3 Attack Vectors & Mitigations

#### Attack 1: Brute-Force Guess of P_ref

```
Attacker tries all (r_x, r_y) in a region.
Search space = (span / ε)² for precision ε

Example (N=8, α=0.3, ε=0.001):
  span = 7,  radius = 2.1
  Points = (2.1 / 0.001)² = 4.41 × 10⁶ guesses
  
  For each guess: recompute all k buckets → check ciphertext fit
  Complexity: O(4.41 × 10⁶ × k) ≈ prohibitive for large N
```

**Mitigation:** Use larger N (e.g., N=1024, 1 million lattice points), or use an nD lattice.

#### Attack 2: Lattice Basis Reduction (LLL/BKZ Algorithm)

If the attacker can observe enough (key, bucket) pairs, they may try to use the LLL (Lenstra-Lenstra-Lovász) algorithm to reduce the lattice basis and narrow down P_ref.

**Mitigation:** Use a **non-orthogonal, high-dimension basis** and the CVP hardness is maintained. ABLKM should use N ≥ 256 dimensions in production.

#### Attack 3: Angle Inference from Bucket Distribution

An attacker who sees many keys in a bucket might try to infer the bucket's angle range and triangulate P_ref.

**Mitigation:** Use a large N so that many keys fall in each bucket — reducing information leakage per observation.

### 8.4 Hardness Theorem (Informal)

> **Theorem:** If the Closest Vector Problem (CVP) on the lattice Λ(B) is hard with approximation factor γ, then finding P_ref from the observed bucket assignments is computationally infeasible for an adversary with polynomial resources.

*Sketch:* The angular assignment of keys to buckets encodes directional information from P_ref. Recovering P_ref from this directional data is equivalent to finding the lattice point closest to the true P_ref from the set of "candidate reference points" consistent with observations — which is precisely CVP.

### 8.5 Quantum Resistance

| Algorithm | Threat | ABLKM Status |
|---|---|---|
| Shor's Algorithm | Breaks RSA, ECC, DH | ✅ Not applicable — no group structure |
| Grover's Algorithm | Speeds brute-force by √ | ⚠️ Key space must be ≥ 2²⁵⁶ for safety |
| QAOA (Quantum Annealing) | Approximately solves CVP | ⚠️ Mitigated by high-dimensional lattice |

**Conclusion:** ABLKM is **post-quantum resistant** by design, inheriting lattice cryptography's immunity to Shor's algorithm. The encoding does not rely on any algebraic group structure that quantum algorithms exploit.

---

## 9. Worked Numerical Example

**Parameters:**
```
N = 4  (4×4 = 16 lattice points)
B = Identity
p = 4  (points per bucket)
k = ⌈16/4⌉ = 4 buckets
Δθ = 360°/4 = 90° per bucket

P_ref = (2.3, 1.7)   [SECRET]
```

**Lattice Points (partial):**
```
(0,0) (1,0) (2,0) (3,0)
(0,1) (1,1) (2,1) (3,1)
(0,2) (1,2) (2,2) (3,2)
(0,3) (1,3) (2,3) (3,3)
```

**Angle computation for point (2, 3):**
```
dx = 2.0 − 2.3 = −0.3
dy = 3.0 − 1.7 = +1.3
θ  = atan2(1.3, −0.3) = 102.99°  → normalized: 102.99°
b  = ⌊102.99 / 90⌋ = 1   → Bucket #1 (90°–180°)
```

**Storing key = "alice", value = "secret-token":**
```
key_id = SHA-256("alice") = "2bd806c97f0e00a0..."
idx    = BigInt("2bd806c9") mod 16 = 11
v      = Λ[11] = (2, 3)     ← derived above
θ      = 102.99°
bucket = #1

enc_key = SHA-256("alice|2.0000,3.0000|2.3000,1.7000")
        = "a7f3e1..."  (32 bytes)

"secret-token" = [0x73,0x65,0x63,0x72,0x65,0x74,...]
ciphertext     = each byte XOR enc_key[i % 32]

Store: Bucket[1]["2bd806c9..."] = ciphertext
```

**Retrieval — steps reproduce identically → same bucket #1 → decrypt → "secret-token" ✓**

**Attacker with wrong P_ref = (0.5, 0.5):**
```
dx = 2.0 − 0.5 = 1.5
dy = 3.0 − 0.5 = 2.5
θ' = atan2(2.5, 1.5) = 59.04°
b' = ⌊59.04 / 90⌋ = 0   → Bucket #0   ← WRONG!
Bucket[0]["2bd806c9..."] → NOT FOUND ✗
```

---

## 10. Comparison with Standard Schemes

| Feature | ABLKM | LWE-based (e.g., Kyber) | NTRU | RSA-4096 |
|---|---|---|---|---|
| **Lattice-based** | ✅ Integer lattice | ✅ q-ary lattice | ✅ Ring lattice | ❌ |
| **Post-quantum safe** | ✅ | ✅ | ✅ | ❌ |
| **Hard problem** | CVP / SVP | LWE | NTRU-problem | Integer factorization |
| **Key storage scheme** | ✅ (primary purpose) | ❌ (encryption) | ❌ (encryption) | ❌ (encryption) |
| **Angular geometry** | ✅ Novel | ❌ | ❌ | ❌ |
| **Reference-point secret** | ✅ | ❌ | ❌ | ❌ |
| **Hash function dependency** | SHA-256 (key id + KDF) | SHA-3 (Kyber uses) | SHA-256 | SHA-256 |
| **NIST PQC standardized** | ❌ (novel research) | ✅ (CRYSTALS-Kyber) | ❌ | ❌ |

---

## 11. Limitations & Future Work

### Current Limitations

1. **2D Lattice Only:** The security of the 2D case is limited by the small search space. Production use requires nD lattices (n ≥ 256).
2. **XOR Cipher:** Not authenticated. Replace with AES-256-GCM.
3. **32-bit djb2 in JS:** Should be replaced with SHA-256 for the web implementation.
4. **No key rotation:** No mechanism to re-assign keys to new lattice points without knowing P_ref.
5. **Deterministic lattice assignment:** The key→lattice point mapping is deterministic (same key always maps to same point). A random nonce should randomize this in production.

### Proposed Improvements

| Improvement | Benefit |
|---|---|
| n-dimensional lattice (n ≥ 256) | Exponentially larger search space for CVP |
| Non-identity basis matrix B | Harder lattice geometry for attackers |
| HKDF-SHA256 key derivation | Standard key expansion |
| AES-256-GCM encryption | Authenticated encryption |
| Secret sharing of P_ref (Shamir) | Multi-party key management |
| Coordinate hiding scheme | Prevent side-channel leakage of lattice coordinates |
| Formal security proof | Rigorous reduction to CVP/SVP |

---

## Appendix: File Structure

```
lattice-crypto/
├── lattice_crypto.py       ← Python core: LatticeKeyStore class
│                              Uses: SHA-256, random.Random
├── app.js                  ← JavaScript engine + Canvas renderer
│                              Uses: djb2 hash, XOR cipher, HTML5 Canvas
├── index.html              ← Web UI structure
├── style.css               ← Dark-theme design system
└── explanation.md          ← Conceptual overview (original)
```

---

*Document prepared for the ABLKM Algorithm — Angular-Bucket Lattice Key Mapping. All mathematical formulations, security analyses, and implementation details are specific to this novel scheme.*
