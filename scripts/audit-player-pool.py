import os
import json
import re

files = [
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000777.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000775.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000772.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Profile 5\Local Storage\leveldb\000079.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Profile 3\Local Storage\leveldb\000972.ldb'
]

# Let's also check all .ldb and .log files in Default and Profile 5
search_dirs = [
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Profile 5\Local Storage\leveldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Profile 3\Local Storage\leveldb'
]

all_files = set(files)
for d in search_dirs:
    if os.path.exists(d):
        for f in os.listdir(d):
            if f.endswith(('.ldb', '.log')):
                all_files.add(os.path.join(d, f))

found_states = []

for path in sorted(all_files):
    if not os.path.exists(path):
        continue
    try:
        with open(path, 'rb') as fp:
            content = fp.read()
    except Exception as e:
        continue

    # Look for {"view": or "playerPool":
    pattern = b'{"view":'
    pos = 0
    while True:
        pos = content.find(pattern, pos)
        if pos == -1:
            break
        
        # Try to parse json from pos
        # Search for end brace
        for end_pos in range(pos + 50, min(pos + 15000000, len(content))):
            if content[end_pos:end_pos+1] == b'}':
                # Check if it could be end
                chunk = content[pos:end_pos+1]
                # Fast balance check
                if chunk.count(b'{') == chunk.count(b'}'):
                    try:
                        decoded = chunk.decode('utf-8', errors='ignore')
                        data = json.loads(decoded)
                        if isinstance(data, dict) and 'playerPool' in data:
                            pool = data.get('playerPool', [])
                            print(f'Found state in {os.path.basename(path)} at offset {pos} with {len(pool)} players')
                            found_states.append((path, pos, data))
                            break
                    except Exception:
                        pass
        pos += len(pattern)

print(f'\nTotal candidate states found: {len(found_states)}')

# Pick the best state with the most players / most images
best_state = None
max_players = -1
for path, pos, st in found_states:
    pool = st.get('playerPool', [])
    images = sum(1 for p in pool if p.get('image'))
    print(f'File {os.path.basename(path)}: {len(pool)} players, {images} with images, teams: {st.get("teamA",{}).get("teamName")} & {st.get("teamB",{}).get("teamName")}')
    if len(pool) > max_players:
        max_players = len(pool)
        best_state = st
    elif len(pool) == max_players and images > sum(1 for p in (best_state.get('playerPool',[]) if best_state else []) if p.get('image')):
        best_state = st

if best_state:
    pool = best_state.get('playerPool', [])
    print(f'\n--- BEST STATE SUMMARY ---')
    print(f'Team A: {best_state.get("teamA")}')
    print(f'Team B: {best_state.get("teamB")}')
    print(f'Total players: {len(pool)}')
    for i, p in enumerate(pool, 1):
        img = p.get('image', '')
        img_type = 'None'
        if img:
            if img.startswith('data:'):
                img_type = f'Base64 ({img[:30]}... len={len(img)})'
            elif img.startswith('http'):
                img_type = f'URL ({img})'
            elif img.startswith('blob:'):
                img_type = f'Blob URL ({img})'
            else:
                img_type = f'Other ({img[:30]})'
        print(f'{i}. ID: {p.get("id")} | Name: {p.get("name")} | Role: {p.get("role")} | Price: {p.get("basePrice")} | Image: {img_type}')

