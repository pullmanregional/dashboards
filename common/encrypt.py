"""
Symmetric encryption and decryption using Fernet.
Run this file directly to print out a new randomly generated key.
"""

import sys, os
import argparse
from cryptography.fernet import Fernet


def encrypt(data: bytes, key: str) -> bytes:
    fernet = Fernet(key)
    encrypted = fernet.encrypt(data)
    return encrypted


def encrypt_file(file: str, outfile: str, key: str):
    with open(file, "rb") as f:
        data = f.read()
    encrypted = encrypt(data, key)
    with open(f"{outfile}", "wb") as f:
        f.write(encrypted)


def decrypt(data: bytes, key: str) -> bytes:
    fernet = Fernet(key)
    decrypted = fernet.decrypt(data)
    return decrypted


def decrypt_file(file: str, outfile: str, key: str):
    with open(file, "rb") as f:
        data = f.read()
    decrypted = decrypt(data, key)
    with open(f"{outfile}", "wb") as f:
        f.write(decrypted)


# Run as script. With no parameters, will generate a new key. Use -key to specify key to use,
# and -encrypt <file> or -decrypt <file> to encrypt / decrypt a file to disk
# Use -out <file> to specify output filename, otherwise will default to <file>.enc or <file>.dec
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Encrypt and decrypt files. Uses Fernet symmetric encryption."
    )
    parser.add_argument("file", help="File to encrypt/decrypt")
    parser.add_argument(
        "-k",
        "--key",
        help="Encryption key to use. If not provided, a new one will be generated",
    )
    parser.add_argument(
        "-d",
        "--decrypt",
        action="store_true",
        help="Decrypt file instead of encrypting",
    )
    parser.add_argument(
        "-o",
        "--out",
        help="Output filename. Defaults to input filename with .enc or .dec extension",
    )
    args = parser.parse_args()

    if not os.path.exists(args.file):
        print(f"File not found: {args.file}")
        sys.exit(1)

    # Use provided key or generate new one
    if args.key:
        key = args.key
        print("Using provided key")
    else:
        key = Fernet.generate_key().decode("utf-8")
        print(f"Using generated key: {key}")

    # Handle encryption
    if not args.decrypt:
        out = args.out if args.out else args.file + ".enc"
        encrypt_file(args.file, out, key)
        print(f"Encrypted {args.file} -> {out}")

    # Handle decryption
    else:
        out = args.out if args.out else args.file + ".dec"
        decrypt_file(args.file, out, key)
        print(f"Decrypted {args.file} -> {out}")
