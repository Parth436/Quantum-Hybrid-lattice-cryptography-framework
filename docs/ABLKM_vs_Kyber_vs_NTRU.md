# ABLKM vs CRYSTALS-Kyber vs NTRU
## Comprehensive Comparative Analysis

**Document Purpose:** A detailed, honest comparison of ABLKM (Angular-Bucket Lattice Key Mapping) against two of the most prominent post-quantum cryptographic standards — CRYSTALS-Kyber and NTRU.

---

## Table of Contents

1. [Background on Each Scheme](#1-background-on-each-scheme)
2. [Core Design Philosophy](#2-core-design-philosophy)
3. [Lattice Types Used](#3-lattice-types-used)
4. [Hard Problems Relied Upon](#4-hard-problems-relied-upon)
5. [Hashing & Key Derivation](#5-hashing--key-derivation)
6. [Feature-by-Feature Comparison Table](#6-feature-by-feature-comparison-table)
7. [ABLKM Advantages over Kyber & NTRU](#7-ablkm-advantages-over-kyber--ntru)
8. [ABLKM Disadvantages over Kyber & NTRU](#8-ablkm-disadvantages-over-kyber--ntru)
9. [Use Case Suitability](#9-use-case-suitability)
10. [Security Level Comparison](#10-security-level-comparison)
11. [Performance Estimates](#11-performance-estimates)
12. [Honest Verdict](#12-honest-verdict)

---

## 1. Background on Each Scheme

### ABLKM — Angular-Bucket Lattice Key Mapping

| Field | Detail |
|---|---|
| **Proposed by** | Novel scheme (this work) |
| **Year** | 2024–2025 |
| **Status** | Experimental / Research |
| **Purpose** | Geometric key storage and retrieval |
| **Core innovation** | Angular mapping of keys relative to a secret reference point on an integer lattice |
| **Standardized?** | ❌ No |

ABLKM is a **key store** — its primary job is to hide and retrieve cryptographic keys by using their angular position on a lattice relative to a private reference point. It is not a general-purpose public-key encryption or key-encapsulation scheme.

---

### CRYSTALS-Kyber

| Field | Detail |
|---|---|
| **Full name** | Cryptographic Suite for Algebraic Lattices — Kyber |
| **Proposed by** | Avanzi et al. (Team of 10 researchers) |
| **Year** | 2017 (updated 2019, 2021) |
| **Status** | ✅ NIST PQC Standard (FIPS 203, finalized 2024) |
| **Purpose** | Key Encapsulation Mechanism (KEM) / Public-Key Encryption |
| **Core innovation** | Module-LWE with NTT-based polynomial arithmetic |
| **Standardized?** | ✅ Yes — FIPS 203 |

Kyber is designed for **key exchange** — two parties (who've never met) can agree on a shared secret over a public channel. It is the de-facto replacement for ECDH in post-quantum systems.

---

### NTRU

| Field | Detail |
|---|---|
| **Full name** | Nth-degree Truncated polynomial Ring Units |
| **Proposed by** | Hoffstein, Pipher, Silverman (MIT/Brown) |
| **Year** | 1996 (patent expired 2017) |
| **Status** | ⚠️ NIST PQC Round 3 Finalist (not selected as primary standard) |
| **Purpose** | Public-key encryption and digital signatures (NTRUSign) |
| **Core innovation** | Hard problem based on short vectors in a specific polynomial ring lattice |
| **Standardized?** | ⚠️ Partially — NTRU Prime submitted; not final FIPS |

NTRU is the **oldest** post-quantum lattice scheme still in practical use. It had a patent for 20+ years, which limited adoption, but is now freely available. It's known for very fast performance but has had some historical vulnerabilities in its signature variant.

---

## 2. Core Design Philosophy

| Aspect | ABLKM | CRYSTALS-Kyber | NTRU |
|---|---|---|---|
| **Paradigm** | Geometric key store | Algebraic key encapsulation | Algebraic encryption |
| **Key idea** | Angular position on lattice hides key locations | Add bounded random noise to a structured problem | Short vectors in a ring are hard to find |
| **Secret** | Reference point P_ref | Private polynomial s, error e | Short private polynomials f, g |
| **Public info** | Lattice structure, bucket ciphertext | Public key matrix A, encrypted key b | Public key h = g/f |
| **How security scales** | Lattice dimension + angular precision | Module dimension k, polynomial degree n | Polynomial degree N |
| **Novelty** | Angular geometry — unique approach | NTT-optimized Module-LWE | Ring-based short-vector problem |

---

## 3. Lattice Types Used

### ABLKM — Integer Lattice (ℤ²)

```
Type:    Point Lattice / Bravais Lattice
Space:   ℝ² (extendable to ℝⁿ)
Basis:   B ∈ GL₂(ℝ) — any invertible 2×2 real matrix
Default: B = I₂ (identity — standard grid)

Structure:
  Λ = { i·b₁ + j·b₂ | i,j ∈ ℤ, 0 ≤ i,j < N }

Key property used:
  CVP — Closest Vector Problem on Λ
```

The lattice is a **simple Euclidean grid** of integer points. Security comes purely from the *geometric* hardness of finding the secret reference point, not from any algebraic structure in the lattice itself.

---

### CRYSTALS-Kyber — Module Lattice over Polynomial Rings

```
Type:    Module Lattice (structured lattice)
Ring:    Rq = ℤq[x] / (xⁿ + 1)   where n=256, q=3329
Module:  Rqᵏ   for k = 2 (Kyber-512), 3 (Kyber-768), 4 (Kyber-1024)

Hard problem: Module-LWE
  A·s + e ≈ b   (mod q)

Where:
  A  = public k×k matrix of polynomials
  s  = secret short polynomial vector
  e  = small random error vector (the "noise")
  b  = public key component
```

The lattice is **algebraically rich** — it uses polynomial rings with specific modular structure (xⁿ+1, q=3329) that enables:
- **NTT (Number Theoretic Transform):** 10–50× faster polynomial multiplication
- **Structured hardness:** harder to attack than unstructured LWE
- **Compact keys:** algebraic structure allows much smaller key sizes

---

### NTRU — Quotient Polynomial Ring Lattice

```
Type:    Ring Lattice (convolution polynomial ring)
Ring:    R = ℤ[x] / (xᴺ - 1)   for NTRU
         or ℤ[x] / (xᴺ + xᴺ/² + 1)  for NTRU Prime

Hard problems:
  1. NTRU problem: Find f, g given h = g · f⁻¹ (mod q)
  2. Equivalent to SVP on the NTRU lattice:
     L = { (u,v) : u·h ≡ v (mod q) }

Key generation:
  f, g ← short random polynomials
  h     = g · f⁻¹ (mod q)   ← public key

Encryption:
  e = r·h + m   (mod q)
  where r = short random polynomial, m = message
```

NTRU's lattice is a **two-dimensional lattice over polynomials** — each element is a polynomial, and the lattice is formed by the convolution structure of the ring. Its hardness is **not cleanly reducible to LWE** — it's based on a distinct assumption (NTRU problem), which is older but less formally understood.

---

## 4. Hard Problems Relied Upon

| Scheme | Primary Hard Problem | Secondary | Quantum Resistance |
|---|---|---|---|
| **ABLKM** | CVP — Closest Vector Problem in ℤ² | SVP (special case) | ✅ No quantum poly-time algorithm |
| **Kyber** | Module-LWE (M-LWE) | MLWE → CVP reduction | ✅ No quantum poly-time algorithm |
| **NTRU** | NTRU Problem (unique) | SVP in NTRU lattice | ✅ No quantum poly-time algorithm |

### Problem Formal Definitions

**CVP (ABLKM):**
> Given a lattice Λ and a target point t ∈ ℝⁿ, find the lattice vector v ∈ Λ closest to t.  
> NP-hard in general; best known algorithm (BKZ) is sub-exponential.

**LWE (Kyber):**
> Given (A, b = A·s + e) where A is random, find the secret s.  
> Errors e are small; without them the problem is trivial. Noise = security.

**NTRU Problem:**
> Given h = g·f⁻¹ mod q (both f and g are short), recover f and g.  
> Related to SVP but distinct — no tight worst-case reduction known.

---

## 5. Hashing & Key Derivation

### ABLKM

| Purpose | Method | Details |
|---|---|---|
| Key identifier | **SHA-256** | `key_id = SHA-256(key_string)` — 256-bit |
| Lattice index | SHA-256 → mod N² | `idx = BigInt(key_id[0:8]) mod N²` |
| Encryption key | **SHA-256 (3-input)** | `enc_key = SHA-256(key ‖ v ‖ P_ref)` |
| JS fast hash | **djb2** | 32-bit non-crypto hash for visualization |
| KDF (demo) | Raw XOR | Not authenticated — for demo only |
| KDF (production) | **HKDF-SHA256** | Standard key expansion |
| PRNG for P_ref | `random.Random` (demo) | Should be `secrets` module in production |

---

### CRYSTALS-Kyber

| Purpose | Method | Details |
|---|---|---|
| Hash/XOF | **SHA3-256, SHA3-512** | Deterministic randomness expansion |
| Key generation | **SHAKE-256** (XOF) | Expandable output function |
| Hashing in encaps | **SHA3-256** | Binds ciphertext to session |
| KDF | **SHA3-256 / SHAKE-256** | Derives shared secret K |
| NTT modulus | q = 3329 (prime) | Enables fast NTT: n = 256 |
| Randomness | System PRNG + SHA3 | FIPS-approved |

Kyber uses the **SHA-3 family** (Keccak-based) throughout — chosen because SHA-3 is structurally different from SHA-2 (different construction), providing protection if SHA-2 is weakened.

---

### NTRU

| Purpose | Method | Details |
|---|---|---|
| Hash | **SHA-256 / SHA3-256** | Depending on variant |
| Key generation | **PRNG + polynomial sampling** | Ternary or binary distributions |
| Message embedding | Direct polynomial encoding | No separate KDF in classic NTRU |
| Modern variants | HKDF / SHAKE | NTRUEncrypt, NTRU-HRSS use SHA-3 |
| Challenge hash (NTRUSign) | **SHA-256** | Was found vulnerable — NTRUSign deprecated |

---

## 6. Feature-by-Feature Comparison Table

| Feature | ABLKM | CRYSTALS-Kyber | NTRU |
|---|---|---|---|
| **Purpose** | Key storage / retrieval | Key encapsulation (KEM) | Public-key encryption |
| **Quantum resistant** | ✅ | ✅ | ✅ |
| **Lattice type** | Integer (ℤ²) | Module polynomial ring | Ring polynomial |
| **Hard problem** | CVP | Module-LWE | NTRU problem |
| **Worst-case reduction** | Informal | ✅ Formal (M-LWE → SVP) | ❌ No tight reduction |
| **Key sizes** | Depends on N | Small (~800B–1.5KB) | Small (~700B–1KB) |
| **Speed** | O(N²) setup | Very fast (NTT) | Very fast (convolution) |
| **Angular geometry** | ✅ Unique | ❌ | ❌ |
| **Secret = reference point** | ✅ | ❌ | ❌ |
| **NIST standardized** | ❌ | ✅ (FIPS 203) | ❌ (finalist only) |
| **Formally proven secure** | ❌ (informal) | ✅ | ⚠️ Partially |
| **Public-key encryption** | ❌ | ✅ | ✅ |
| **Key exchange (KEM)** | ❌ | ✅ | ✅ (with adaptation) |
| **Digital signatures** | ❌ | ❌ (Dilithium is separate) | ⚠️ Deprecated (NTRUSign broken) |
| **Buckets / sectors** | ✅ | ❌ | ❌ |
| **Reference point concept** | ✅ | ❌ | ❌ |
| **Flexible lattice basis** | ✅ | ❌ (fixed ring) | ❌ (fixed ring) |
| **Patent-free** | ✅ | ✅ | ✅ (since 2017) |
| **Open source impl** | ✅ (this repo) | ✅ (pqclean, liboqs) | ✅ (libntru) |
| **Hash used** | SHA-256 / djb2 | SHA-3 / SHAKE-256 | SHA-256 / SHA-3 |

---

## 7. ABLKM Advantages over Kyber & NTRU

### ✅ Advantage 1: Geometric Intuition — Unique Mental Model

Both Kyber and NTRU are **algebraic** — their security comes from abstract polynomial rings. Understanding why they're hard requires deep ring theory knowledge.

ABLKM's security is **geometric**: standing at a secret point in space, looking at a grid. This makes:
- Easier to explain to non-cryptographers
- Easier to visualize and audit
- Easier to reason about spatially in nD space

> *"You can literally draw ABLKM's security on a whiteboard. You cannot do that with NTRU."*

---

### ✅ Advantage 2: Purpose-Built Key Store

Kyber and NTRU are **key encapsulation / encryption** primitives — they're not designed to store and retrieve multiple keys efficiently.

ABLKM is specifically designed as a **key storage system**:
- Store N keys, retrieve any of them in O(1) time
- Each key maps to a unique angular bucket
- Natural structure for a multi-key vault (like a password manager or HSM)
- Kyber/NTRU would need an additional layer of infrastructure to do the same job

---

### ✅ Advantage 3: Flexible Lattice Basis

ABLKM can use **any invertible basis matrix** — allowing the lattice to be tailored:
- Standard (identity): simple, fast
- Rotated: harder to detect structure
- Random high-dimensional: best security

Kyber and NTRU are locked into **fixed ring structures** (xⁿ+1 mod q for Kyber; xᴺ−1 for NTRU). While these are carefully chosen for performance, they have no flexibility — any vulnerability in that specific ring structure affects all users.

---

### ✅ Advantage 4: No Group Structure to Attack

Kyber's Module-LWE and NTRU's ring both have **algebraic group structure** — this is what enables their fast NTT operations, but it also means:
- Algebraic attacks (like subfield attacks on Ring-LWE) are possible in theory
- The ring structure constrains the lattice geometry

ABLKM's integer lattice has **no special algebraic structure** (when using a random basis). This means:
- Fewer attack surfaces from algebraic methods
- No polynomial ring — no NTT-based attacks
- Closer to the pure unstructured CVP hardness assumption

---

### ✅ Advantage 5: Transparent Security Parameter

In ABLKM, security visually scales with easily understood parameters:
- **Larger N** = more lattice points = harder CVP
- **Smaller ε (reference precision)** = finer angles = harder to guess P_ref
- **Higher dimension** = exponentially harder brute force

In Kyber, parameters like `k=3, q=3329, n=256` are chosen by deep mathematical analysis. In NTRU, choosing wrong N causes practical attacks. ABLKM's parameters are **more self-explanatory**.

---

### ✅ Advantage 6: Reference Point Decoupling

The secret in ABLKM (P_ref) is **geometrically separate** from the lattice structure (Λ). This means:
- The reference point can be stored separately from the ciphertext
- The reference point can be physically or geographically isolated
- Multiple schemes (Shamir's Secret Sharing) can be applied to share P_ref among trusted parties

In Kyber and NTRU, the private key is algebraically entangled with the structure — it's harder to meaningfully split or physically separate.

---

## 8. ABLKM Disadvantages over Kyber & NTRU

### ❌ Disadvantage 1: Not Standardized

This is the biggest disadvantage.

| Scheme | Standard | Since |
|---|---|---|
| Kyber | FIPS 203 (NIST) | 2024 |
| NTRU | IEEE P1363.1, EESS | 2009 |
| ABLKM | None | — |

Kyber has undergone **7 years of public cryptanalysis** by hundreds of researchers worldwide. NTRU has been analyzed for **nearly 30 years**. ABLKM has not passed any formal peer review or cryptanalysis process.

**⚠️ Critical:** No cryptographic scheme should be used in production without formal security proofs and independent cryptanalysis. ABLKM is currently research-grade only.

---

### ❌ Disadvantage 2: No Formal Security Proof

Kyber has a **formal security proof**: it is provably reducible to Module-LWE, which is in turn reducible to worst-case SVP on module lattices. This means breaking Kyber implies solving a known-hard lattice problem.

NTRU has a partial reduction. ABLKM has **no formal reduction** — the claim that finding P_ref is equivalent to CVP is informal and has not been proven rigorously.

---

### ❌ Disadvantage 3: 2D Lattice is Weak

The current implementation uses a **2D integer lattice** (N×N grid). In 2D:
- CVP can be solved efficiently using Gauss reduction
- An attacker can brute-force the reference point with ~10⁶ trials for small N
- **2D ABLKM provides minimal real-world security**

Kyber uses a **256-dimensional polynomial ring** — CVP in 256 dimensions is exponentially harder. NTRU uses degree-509 to degree-1277 polynomials — again exponentially dimensional.

**ABLKM needs N ≥ 256 dimensions to achieve comparable security.**

---

### ❌ Disadvantage 4: Slower Key Operations

| Operation | ABLKM (N=8) | Kyber-768 | NTRU (N=761) |
|---|---|---|---|
| Setup | O(N²) | O(k²n log n) | O(N log N) |
| Key gen | O(N²) | ~50 μs | ~300 μs |
| Encrypt/Store | O(N²) | ~60 μs | ~350 μs |
| Decrypt/Retrieve | O(N²) | ~60 μs | ~350 μs |

Kyber uses **NTT (Number Theoretic Transform)** for O(n log n) polynomial multiplication. NTRU uses convolution. Both are highly optimized.

ABLKM's O(N²) lattice setup with SHA-256 calls is slower and unoptimized.

---

### ❌ Disadvantage 5: Not General-Purpose

| Capability | ABLKM | Kyber | NTRU |
|---|---|---|---|
| Key storage / vault | ✅ | ❌ (needs extra layer) | ❌ |
| Public-key encryption | ❌ | ✅ | ✅ |
| Key exchange (KEM) | ❌ | ✅ | ✅ |
| Digital signatures | ❌ | ✅ (via Dilithium) | ❌ (NTRUSign broken) |
| Password-authenticated KE | ❌ | ✅ | ✅ |

ABLKM **cannot** be used for two parties to agree on a shared secret (key exchange). It **cannot** encrypt a message for a recipient without a shared P_ref. This severely limits its applicability today.

---

### ❌ Disadvantage 6: No Authenticated Encryption (Current Form)

The current XOR-based encryption in ABLKM is:
- **Not authenticated** — a tampered ciphertext will decrypt to garbage without detection
- **Not IND-CCA2 secure** — it can be susceptible to chosen-ciphertext attacks
- **Key reuse vulnerable** — same key always maps to same lattice point

Kyber achieves **IND-CCA2 security** (strongest standard for encryption). NTRU achieves IND-CCA2 with NTRU-HRSS and proper padding. ABLKM needs AES-256-GCM to reach this level.

---

### ❌ Disadvantage 7: Deterministic Key-to-Point Mapping

In ABLKM, the same key string always maps to the same lattice point (deterministic via SHA-256 mod N²):
- An attacker who tries a key and observes which bucket it lands in gains information
- No randomization per attempt
- Susceptible to offline dictionary attacks on key IDs

Kyber uses **randomized encapsulation** — even encrypting the same message twice gives different ciphertexts. This provides **semantic security**. ABLKM lacks this by default.

---

## 9. Use Case Suitability

| Use Case | ABLKM | Kyber | NTRU |
|---|---|---|---|
| **Secure password manager** | ✅ Best fit | ⚠️ Needs wrapper | ⚠️ Needs wrapper |
| **TLS / HTTPS replacement** | ❌ | ✅ Best fit | ✅ |
| **Hardware Security Module (HSM) key vault** | ✅ Conceptually | ⚠️ | ⚠️ |
| **IoT device key storage** | ⚠️ (needs nD) | ✅ | ✅ |
| **Post-quantum VPN** | ❌ | ✅ | ✅ |
| **Encrypted email** | ❌ | ✅ | ✅ |
| **Multi-party key splitting** | ✅ (P_ref splitting) | ⚠️ | ⚠️ |
| **Academic / research** | ✅ Novel contribution | ✅ Reference impl | ✅ Historical study |
| **Production deployment** | ❌ Not yet | ✅ | ⚠️ Caution |

---

## 10. Security Level Comparison

NIST defines 5 security levels; Level 3 (equivalent to AES-192) is the minimum for new deployments.

| Scheme | NIST Level | Classical Security | Quantum Security |
|---|---|---|---|
| **ABLKM (2D, N=8)** | < Level 1 | < 40 bits | < 20 bits |
| **ABLKM (nD, N=1024)** | ~Level 3 (estimated) | ~192 bits | ~128 bits |
| **Kyber-512** | Level 1 | 128-bit | 100-bit |
| **Kyber-768** | Level 3 | 192-bit | 157-bit |
| **Kyber-1024** | Level 5 | 256-bit | 230-bit |
| **NTRU-HPS-2048-509** | Level 1 | 128-bit | ~107-bit |
| **NTRU-HPS-2048-677** | Level 3 | 192-bit | ~157-bit |
| **NTRU-HPS-4096-821** | Level 5 | 256-bit | ~230-bit |

> ⚠️ The ABLKM 2D implementation in this repository has **less than 40 bits of effective security** and should **never** be used in any real security context without upgrading to high-dimensional lattices.

---

## 11. Performance Estimates

*Benchmarks for reference; ABLKM figures are estimates for the Python reference implementation.*

| Operation | ABLKM (Python, N=8) | Kyber-768 (C, AVX2) | NTRU-761 (C) |
|---|---|---|---|
| Key generation | ~1 ms | 0.059 ms | 0.297 ms |
| Store/Encapsulate | ~0.5 ms | 0.062 ms | 0.350 ms |
| Retrieve/Decapsulate | ~0.5 ms | 0.060 ms | 0.349 ms |
| Public key size | N/A | 1,184 bytes | 1,158 bytes |
| Private key size | 8 bytes (2D ref pt) | 2,400 bytes | 1,763 bytes |
| Ciphertext size | Variable | 1,088 bytes | 1,039 bytes |

Kyber is significantly faster due to:
1. **NTT** — fast polynomial multiplication
2. **Optimized C with AVX2** intrinsics
3. **20+ years of engineering optimization**

ABLKM's Python reference is unoptimized. A C/Rust implementation of ABLKM in high dimensions would have different characteristics.

---

## 12. Honest Verdict

```
┌─────────────────────────────────────────────────────────────────┐
│  Ready for production?                                          │
│                                                                 │
│  CRYSTALS-Kyber : ✅ YES — NIST standard, deploy now           │
│  NTRU           : ⚠️  CAUTION — Mature but not FIPS standard   │
│  ABLKM          : ❌ NO — Research only, needs major work       │
└─────────────────────────────────────────────────────────────────┘
```

### Summary Assessment

**CRYSTALS-Kyber** is the clear winner for production deployment today. It has formal security proofs, NIST standardization, blazing-fast NTT operations, and years of cryptanalysis. It is the future of post-quantum key exchange.

**NTRU** is a proven workhorse — nearly 30 years old and still standing. Its signature variant (NTRUSign) was broken and deprecated, but the encryption scheme is considered secure. It's a reasonable choice where patent-free, pre-NIST schemes are needed.

**ABLKM** is the most **innovative** in concept — angular geometry on a lattice is a genuinely novel idea that brings geometric intuition to cryptography. Its natural fit as a key-storage vault (not just encryption) is a real architectural advantage. However:

- It lacks formal security proofs
- Its 2D implementation is not secure
- It needs 7+ years of peer review before being trustworthy

### Recommendation

| If you need... | Use |
|---|---|
| Post-quantum key exchange today | **Kyber-768** |
| Post-quantum encryption (NIST) | **Kyber-1024** |
| Legacy compatibility | **NTRU-761** |
| A novel geometric key vault (research) | **ABLKM (nD, N≥256)** + formal proof |
| Inspiration for new PQC designs | **ABLKM** — explore and extend |

> **ABLKM is not a replacement for Kyber or NTRU today. It is a promising architectural idea that, with rigorous formalization and high-dimensional extension, could become a new class of post-quantum key storage primitive.**

---

## References

| Scheme | Key References |
|---|---|
| CRYSTALS-Kyber | NIST FIPS 203 (2024); Avanzi et al., "CRYSTALS-Kyber Algorithm Specifications," 2021 |
| NTRU | Hoffstein, Pipher, Silverman, "NTRU: A Ring-Based Public Key Cryptosystem," ANTS 1998 |
| CVP Hardness | Micciancio & Goldwasser, "Complexity of Lattice Problems," Kluwer 2002 |
| LWE | Regev, "On Lattices, Learning with Errors…," STOC 2005 |
| BKZ Algorithm | Schnorr & Euchner, "Lattice basis reduction," 1994 |
| Post-quantum survey | Bernstein & Lange, "Post-quantum cryptography," Nature, 2017 |
| ABLKM | This work — Angular-Bucket Lattice Key Mapping, 2025 |
