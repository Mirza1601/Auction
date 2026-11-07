import os
import json
import base64
import io
import shutil
from PIL import Image

backup_base = os.path.abspath('auction_nexus_full_backup')
os.makedirs(backup_base, exist_ok=True)

# ─── 1. BACKUP PROFILE 5 (KKR vs SRM) ─────────────────────────
p5_dir = os.path.join(backup_base, 'profile_kkr_srm')
p5_img_dir = os.path.join(p5_dir, 'player_images')
os.makedirs(p5_img_dir, exist_ok=True)

with open(r'auction_nexus_full_backup\auction_nexus_metadata.json', 'r', encoding='utf-8') as f:
    state_p5 = json.load(f)

with open(os.path.join(p5_dir, 'state.json'), 'w', encoding='utf-8') as f:
    json.dump(state_p5, f, indent=2)

inventory_p5 = []
for p in state_p5.get('playerPool', []):
    raw_img = p.get('image', '')
    ext = 'jpeg'
    dims = None
    size = 0
    filename = None
    valid = False
    if raw_img and raw_img.startswith('data:'):
        header, b64 = raw_img.split(',', 1)
        b = base64.b64decode(b64)
        size = len(b)
        try:
            im = Image.open(io.BytesIO(b))
            dims = f'{im.width}x{im.height}'
            fmt = im.format or 'JPEG'
            ext = 'png' if fmt.upper() == 'PNG' else 'jpeg'
            filename = f"{p['id']}_{p['name'].replace(' ', '_')}.{ext}"
            with open(os.path.join(p5_img_dir, filename), 'wb') as out_f:
                out_f.write(b)
            valid = True
        except Exception as e:
            print('Corrupt image p5:', p['name'], e)
    inventory_p5.append({
        'id': p.get('id'), 'name': p.get('name'), 'role': p.get('role'),
        'basePrice': p.get('basePrice'), 'soldPrice': p.get('soldPrice'),
        'soldTo': p.get('soldTo'), 'valid': valid, 'dimensions': dims,
        'byte_size': size, 'filename': filename
    })

with open(os.path.join(p5_dir, 'inventory.json'), 'w', encoding='utf-8') as f:
    json.dump(inventory_p5, f, indent=2)

# ─── 2. BACKUP DEFAULT PROFILE (Team A vs Team B) ─────────────
def_dir = os.path.join(backup_base, 'default_profile')
def_img_dir = os.path.join(def_dir, 'player_images')
os.makedirs(def_img_dir, exist_ok=True)

path_default = r'C:\Users\Mirza Zabiullah\AppData\Local\Google\Chrome\User Data\Default\Local Storage\leveldb\000777.ldb'
with open(path_default, 'rb') as f:
    content = f.read()

pattern = b'{"view":'
pos = content.find(pattern)
state_def = None
for end_pos in range(pos + 50, min(pos + 15000000, len(content))):
    if content[end_pos:end_pos+1] == b'}':
        chunk = content[pos:end_pos+1]
        if chunk.count(b'{') == chunk.count(b'}'):
            try:
                state_def = json.loads(chunk.decode('utf-8', errors='ignore'))
                break
            except Exception:
                pass

with open(os.path.join(def_dir, 'state.json'), 'w', encoding='utf-8') as f:
    json.dump(state_def, f, indent=2)

inventory_def = []
for p in state_def.get('playerPool', []):
    raw_img = p.get('image', '')
    ext = 'jpeg'
    dims = None
    size = 0
    filename = None
    valid = False
    if raw_img and raw_img.startswith('data:'):
        header, b64 = raw_img.split(',', 1)
        b = base64.b64decode(b64)
        size = len(b)
        try:
            im = Image.open(io.BytesIO(b))
            dims = f'{im.width}x{im.height}'
            fmt = im.format or 'JPEG'
            ext = 'png' if fmt.upper() == 'PNG' else 'jpeg'
            filename = f"{p['id']}_{p['name'].replace(' ', '_')}.{ext}"
            with open(os.path.join(def_img_dir, filename), 'wb') as out_f:
                out_f.write(b)
            valid = True
        except Exception as e:
            print('Corrupt image def:', p['name'], e)
    inventory_def.append({
        'id': p.get('id'), 'name': p.get('name'), 'role': p.get('role'),
        'basePrice': p.get('basePrice'), 'soldPrice': p.get('soldPrice'),
        'soldTo': p.get('soldTo'), 'valid': valid, 'dimensions': dims,
        'byte_size': size, 'filename': filename
    })

with open(os.path.join(def_dir, 'inventory.json'), 'w', encoding='utf-8') as f:
    json.dump(inventory_def, f, indent=2)

# ─── 3. BACKUP RAW LOCAL PLAYER PICS FOLDER ────────────────────
raw_pics_src = os.path.abspath('player_pics')
raw_pics_dst = os.path.join(backup_base, 'original_player_pics')
os.makedirs(raw_pics_dst, exist_ok=True)
raw_pics_inventory = []
if os.path.exists(raw_pics_src):
    for fn in os.listdir(raw_pics_src):
        src_path = os.path.join(raw_pics_src, fn)
        if os.path.isfile(src_path):
            dst_path = os.path.join(raw_pics_dst, fn)
            shutil.copy2(src_path, dst_path)
            try:
                with Image.open(src_path) as im:
                    dims = f'{im.width}x{im.height}'
                    fmt = im.format
            except Exception:
                dims = 'Unknown'
                fmt = 'Unknown'
            raw_pics_inventory.append({
                'filename': fn,
                'byte_size': os.path.getsize(src_path),
                'dimensions': dims,
                'format': fmt
            })

with open(os.path.join(backup_base, 'original_player_pics_inventory.json'), 'w', encoding='utf-8') as f:
    json.dump(raw_pics_inventory, f, indent=2)

print('=== COMPLETE AUDIT & BACKUP COMPLETED ===')
print(f'1. Profile 5 (KKR vs SRM): {len(inventory_p5)} players, {sum(1 for i in inventory_p5 if i["valid"])} valid images')
print(f'2. Default Profile (Team A vs Team B): {len(inventory_def)} players, {sum(1 for i in inventory_def if i["valid"])} valid images')
print(f'3. Original player_pics folder: {len(raw_pics_inventory)} high-res source images preserved')

