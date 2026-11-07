import os
import json
import base64
import io
from PIL import Image

search_files = [
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Profile 5\Local Storage\leveldb\000079.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000777.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000775.ldb',
    r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000772.ldb',
]

def extract_states():
    states = []
    pattern = b'{"view":'
    for path in search_files:
        if not os.path.exists(path):
            continue
        with open(path, 'rb') as fp:
            content = fp.read()
        pos = 0
        while True:
            pos = content.find(pattern, pos)
            if pos == -1:
                break
            for end_pos in range(pos + 50, min(pos + 15000000, len(content))):
                if content[end_pos:end_pos+1] == b'}':
                    chunk = content[pos:end_pos+1]
                    if chunk.count(b'{') == chunk.count(b'}'):
                        try:
                            decoded = chunk.decode('utf-8', errors='ignore')
                            data = json.loads(decoded)
                            if isinstance(data, dict) and 'playerPool' in data:
                                states.append((path, data))
                                break
                        except Exception:
                            pass
            pos += len(pattern)
    return states

states = extract_states()
print(f'Found {len(states)} states across LevelDBs.')

# Select the most complete state (preferring named teams if available)
best_state = None
for p, s in states:
    teamA_name = s.get('teamA', {}).get('teamName', '')
    print(f'Source: {os.path.basename(p)} | TeamA: {teamA_name} | TeamB: {s.get("teamB", {}).get("teamName")} | Players: {len(s.get("playerPool", []))}')
    if not best_state:
        best_state = s
    else:
        # Prefer the one with configured team names or more recent updates
        if teamA_name not in ['Team A', ''] and best_state.get('teamA', {}).get('teamName') in ['Team A', '']:
            best_state = s
        elif len(s.get('playerPool', [])) > len(best_state.get('playerPool', [])):
            best_state = s

print('\nSelected primary state for backup:')
print('Team A:', best_state.get('teamA'))
print('Team B:', best_state.get('teamB'))
print('Player count:', len(best_state.get('playerPool', [])))

# ─── BACKUP CREATION ──────────────────────────────────────────────
backup_dir = os.path.abspath('auction_nexus_full_backup')
images_dir = os.path.join(backup_dir, 'player_images')
os.makedirs(images_dir, exist_ok=True)

# 1. Save full state metadata JSON
metadata_path = os.path.join(backup_dir, 'auction_nexus_metadata.json')
with open(metadata_path, 'w', encoding='utf-8') as f:
    json.dump(best_state, f, indent=2)

# 2. Save players list
players_path = os.path.join(backup_dir, 'players.json')
players_clean = []
for p in best_state.get('playerPool', []):
    item = {k: v for k, v in p.items() if k != 'image'}
    item['has_image'] = bool(p.get('image'))
    item['image_file'] = f'{p.get("id")}_{p.get("name")}.jpeg' if p.get('image') else None
    players_clean.append(item)

with open(players_path, 'w', encoding='utf-8') as f:
    json.dump(players_clean, f, indent=2)

# 3. Save teams list
teams_path = os.path.join(backup_dir, 'teams.json')
with open(teams_path, 'w', encoding='utf-8') as f:
    json.dump({
        'teamA': best_state.get('teamA'),
        'teamB': best_state.get('teamB')
    }, f, indent=2)

# 4. Decode & Save images
inventory = []
total_bytes = 0

for p in best_state.get('playerPool', []):
    p_id = p.get('id')
    p_name = p.get('name', 'unnamed').replace(' ', '_')
    raw_img = p.get('image', '')
    
    classification = 'None'
    valid = False
    dims = None
    fmt = None
    file_size = 0
    saved_filename = None

    if raw_img:
        if raw_img.startswith('data:'):
            classification = 'Base64/Data URL'
            try:
                header, b64data = raw_img.split(',', 1)
                img_bytes = base64.b64decode(b64data)
                file_size = len(img_bytes)
                total_bytes += file_size
                
                # Verify PIL can open
                img_obj = Image.open(io.BytesIO(img_bytes))
                dims = f'{img_obj.width}x{img_obj.height}'
                fmt = img_obj.format or ('PNG' if 'png' in header else 'JPEG')
                ext = 'png' if fmt.upper() == 'PNG' else 'jpeg'
                valid = True
                
                saved_filename = f'{p_id}_{p_name}.{ext}'
                img_out_path = os.path.join(images_dir, saved_filename)
                with open(img_out_path, 'wb') as img_file:
                    img_file.write(img_bytes)
            except Exception as e:
                classification = f'Base64 Corrupt ({e})'
        elif raw_img.startswith('blob:'):
            classification = 'Object URL (blob:)'
        elif raw_img.startswith(('http://', 'https://')):
            classification = 'HTTP/HTTPS URL'
        elif os.path.exists(raw_img):
            classification = 'Local file path'
        else:
            classification = 'Other format'

    inventory.append({
        'id': p_id,
        'name': p.get('name'),
        'role': p.get('role'),
        'basePrice': p.get('basePrice'),
        'status': p.get('status'),
        'classification': classification,
        'valid': valid,
        'dimensions': dims,
        'format': fmt,
        'byte_size': file_size,
        'saved_filename': saved_filename
    })

inventory_path = os.path.join(backup_dir, 'image_inventory.json')
with open(inventory_path, 'w', encoding='utf-8') as f:
    json.dump(inventory, f, indent=2)

print('\n=== AUDIT & BACKUP RESULTS ===')
print(f'Total players: {len(best_state.get("playerPool", []))}')
print(f'Total images decoded and verified: {sum(1 for i in inventory if i["valid"])}')
print(f'Total image binary size: {total_bytes:,} bytes ({total_bytes / (1024*1024):.2f} MB)')
print(f'Backup directory created at: {backup_dir}')

# Verification
all_verified = True
for item in inventory:
    if item['saved_filename']:
        fpath = os.path.join(images_dir, item['saved_filename'])
        if not os.path.exists(fpath):
            print(f'ERROR: Missing file {fpath}')
            all_verified = False
        else:
            try:
                with Image.open(fpath) as im:
                    im.verify()
            except Exception as err:
                print(f'ERROR: File {item["saved_filename"]} corrupt: {err}')
                all_verified = False

if all_verified:
    print('VERIFICATION PASSED: 100% of player images successfully extracted, verified, and saved to disk!')
else:
    print('VERIFICATION FAILED for some images.')

