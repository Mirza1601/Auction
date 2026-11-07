import json
import os

with open(r'auction_nexus_full_backup\auction_nexus_metadata.json', 'r', encoding='utf-8') as f:
    state_profile5 = json.load(f)

# Now extract state from 000777.ldb
path_default = r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000777.ldb'
with open(path_default, 'rb') as f:
    content = f.read()

pattern = b'{"view":'
pos = content.find(pattern)
state_default = None
for end_pos in range(pos + 50, min(pos + 15000000, len(content))):
    if content[end_pos:end_pos+1] == b'}':
        chunk = content[pos:end_pos+1]
        if chunk.count(b'{') == chunk.count(b'}'):
            try:
                state_default = json.loads(chunk.decode('utf-8', errors='ignore'))
                break
            except Exception:
                pass

print('=== PROFILE 5 (KKR vs SRM) ===')
pool5 = state_profile5.get('playerPool', [])
print(f'Player count: {len(pool5)}')
for p in pool5:
    print(f" - {p.get('id')}: {p.get('name')} ({p.get('role')}) - Base: {p.get('basePrice')} - Sold: {p.get('soldPrice')} to {p.get('soldTo')} - Img: {bool(p.get('image'))}")

print('\n=== DEFAULT PROFILE (Team A vs Team B) ===')
pool_def = state_default.get('playerPool', []) if state_default else []
print(f'Player count: {len(pool_def)}')
for p in pool_def:
    print(f" - {p.get('id')}: {p.get('name')} ({p.get('role')}) - Base: {p.get('basePrice')} - Sold: {p.get('soldPrice')} to {p.get('soldTo')} - Img: {bool(p.get('image'))}")

