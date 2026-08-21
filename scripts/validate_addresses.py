import re

addresses = {
    "TRC20": "TJ8ujYSpvqxEb5PqoLrwE5UfKC9y6rNtQo",
    "BEP20": "0xF071f5f6D703dF16cE3715A912ef08791b783CDe",
    "Solana": "HqjaGA1uptgrmhiBNz9apbbNzNAPULHs6KWiGqmJZKMd",
}
base58 = set("123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")

def base58check_shape(value: str, prefix: str | None = None) -> bool:
    if prefix and not value.startswith(prefix):
        return False
    return 20 <= len(value) <= 50 and all(c in base58 for c in value)

print(f"TRC20 syntax valid: {addresses['TRC20'].startswith('T') and base58check_shape(addresses['TRC20'], 'T')}")
print(f"BEP20 syntax valid: {bool(re.fullmatch(r'0x[a-fA-F0-9]{40}', addresses['BEP20']))}")
print(f"Solana syntax valid: {base58check_shape(addresses['Solana']) and len(addresses['Solana']) in range(32, 45)}")
print("Addresses are public receiving addresses only; this script does not check ownership, token balances, contract code, or custody controls.")
